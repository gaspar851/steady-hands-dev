import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creditDepositIfConfirmed } from "@/lib/wallet.server";

/**
 * Helius "Enhanced webhook" for SPL token transfers.
 *
 * Configure in Helius dashboard:
 *   - Webhook URL: https://<your-domain>/api/public/webhooks/deposits/solana
 *   - Transaction type: TOKEN_TRANSFER
 *   - Account addresses: the Solana addresses minted by
 *     getOrCreateDepositAddressForUser
 *   - Authorization header: set to the value of HELIUS_WEBHOOK_SECRET
 */

const USDT_MINT_MAINNET = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

function verifyHeliusAuth(header: string | null): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  try {
    return timingSafeEqual(Buffer.from(header, "utf8"), Buffer.from(secret, "utf8"));
  } catch {
    return false;
  }
}

type HeliusTokenTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  toTokenAccount?: string;
  mint?: string;
  tokenAmount?: number;
};

type HeliusTx = {
  signature?: string;
  tokenTransfers?: HeliusTokenTransfer[];
};

export const Route = createFileRoute("/api/public/webhooks/deposits/solana")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyHeliusAuth(request.headers.get("authorization"))) {
          return new Response("Invalid signature", { status: 401 });
        }
        const body = await request.text();
        let txs: HeliusTx[];
        try {
          txs = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(txs)) return new Response("Invalid payload", { status: 400 });

        const mainnet = process.env.WALLET_NETWORK === "mainnet";

        for (const tx of txs) {
          const sig = tx.signature;
          if (!sig) continue;
          const transfers = tx.tokenTransfers ?? [];
          let logIndex = 0;
          for (const t of transfers) {
            if (mainnet && t.mint !== USDT_MINT_MAINNET) {
              logIndex += 1;
              continue;
            }
            const to = t.toUserAccount;
            if (!to) {
              logIndex += 1;
              continue;
            }
            // Match user by the *owner* address (toUserAccount). The on-chain
            // SPL associated token account belongs to that owner.
            const { data: addr } = await supabaseAdmin
              .from("deposit_addresses")
              .select("user_id,address_lower")
              .eq("chain", "solana")
              .eq("address_lower", to.toLowerCase())
              .maybeSingle();
            if (!addr) {
              logIndex += 1;
              continue;
            }

            const amount = Number(t.tokenAmount ?? 0);
            if (!Number.isFinite(amount) || amount <= 0) {
              logIndex += 1;
              continue;
            }

            const { data: dep, error } = await supabaseAdmin
              .from("deposits")
              .upsert(
                {
                  user_id: addr.user_id,
                  chain: "solana",
                  tx_hash: sig,
                  log_index: logIndex,
                  from_address: t.fromUserAccount ?? null,
                  to_address: to,
                  token: "USDT",
                  token_contract: t.mint ?? null,
                  amount,
                  confirmations: 32,
                  status: "confirmed",
                  raw: t as never,
                },
                { onConflict: "chain,tx_hash,log_index" },
              )
              .select("id")
              .single();
            if (!error && dep) await creditDepositIfConfirmed(dep.id);
            logIndex += 1;
          }
        }

        return new Response("ok");
      },
    },
  },
});
