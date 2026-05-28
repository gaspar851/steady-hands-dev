import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creditDepositIfConfirmed } from "@/lib/wallet.server";

/**
 * Alchemy "Address Activity" webhook for ERC-20 USDT transfers.
 *
 * Configure in Alchemy dashboard:
 *   - Type: Address Activity
 *   - Webhook URL: https://<your-domain>/api/public/webhooks/deposits/evm
 *   - Network: Ethereum Mainnet (or Sepolia)
 *   - Addresses: the addresses minted by getOrCreateDepositAddressForUser
 *     (you'll need to re-sync addresses periodically; see scripts/sync-alchemy.ts)
 *   - Signing key: copy to the ALCHEMY_WEBHOOK_SIGNING_KEY secret
 */

const USDT_CONTRACT_MAINNET = "0xdac17f958d2ee523a2206206994597c13d831ec7";
// Sepolia has no canonical USDT; we accept any ERC-20 transfer in testnet mode
// and tag it as USDT for ease of testing.
const MIN_CONFIRMATIONS = 12;

function verifyAlchemySignature(body: string, signature: string | null): boolean {
  const secret = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/webhooks/deposits/evm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-alchemy-signature");
        if (!verifyAlchemySignature(body, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const ev = payload as {
          event?: {
            activity?: Array<{
              fromAddress?: string;
              toAddress?: string;
              value?: number;
              asset?: string;
              hash?: string;
              log?: { logIndex?: number };
              rawContract?: { address?: string; decimals?: number };
              category?: string;
              network?: string;
            }>;
          };
        };

        const activity = ev.event?.activity ?? [];
        const mainnet = process.env.WALLET_NETWORK === "mainnet";

        for (const a of activity) {
          const to = a.toAddress?.toLowerCase();
          if (!to) continue;
          const contract = a.rawContract?.address?.toLowerCase();
          if (mainnet && contract !== USDT_CONTRACT_MAINNET) continue;

          // Resolve the receiving deposit_address row -> user.
          const { data: addr } = await supabaseAdmin
            .from("deposit_addresses")
            .select("user_id,address_lower")
            .eq("chain", "evm")
            .eq("address_lower", to)
            .maybeSingle();
          if (!addr) continue;

          const amount = Number(a.value ?? 0);
          if (!Number.isFinite(amount) || amount <= 0) continue;

          // Upsert (idempotent on chain+tx_hash+log_index).
          const txHash = a.hash ?? "";
          const logIndex = a.log?.logIndex ?? 0;
          if (!txHash) continue;

          const status = "confirmed"; // Alchemy only fires on confirmed mined txs.
          const { data: dep, error } = await supabaseAdmin
            .from("deposits")
            .upsert(
              {
                user_id: addr.user_id,
                chain: "evm",
                tx_hash: txHash,
                log_index: logIndex,
                from_address: a.fromAddress ?? null,
                to_address: to,
                token: "USDT",
                token_contract: contract ?? null,
                amount,
                confirmations: MIN_CONFIRMATIONS,
                status,
                raw: a as unknown as Record<string, unknown>,
              },
              { onConflict: "chain,tx_hash,log_index" },
            )
            .select("id")
            .single();
          if (error || !dep) continue;
          await creditDepositIfConfirmed(dep.id);
        }

        return new Response("ok");
      },
    },
  },
});
