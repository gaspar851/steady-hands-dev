import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  issueNonce,
  verifySignedMessage,
  findOrCreateWalletUserAndMintSession,
  linkWalletToUser,
  getOrCreateDepositAddressForUser,
} from "./wallet.server";

const ChainSchema = z.enum(["evm", "solana"]);

const EvmAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address");
const SolanaAddress = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address");

const NonceInput = z.object({
  chain: ChainSchema,
  address: z.string().min(1).max(128),
  origin: z.string().url().max(2048),
  chainId: z.number().int().positive().optional(),
});

const VerifyInput = z.object({
  chain: ChainSchema,
  address: z.string().min(1).max(128),
  message: z.string().min(1).max(4096),
  signature: z.string().min(1).max(512),
});

function validateAddress(chain: "evm" | "solana", address: string) {
  if (chain === "evm") EvmAddress.parse(address);
  else SolanaAddress.parse(address);
}

export const getWalletNonce = createServerFn({ method: "POST" })
  .inputValidator((input) => NonceInput.parse(input))
  .handler(async ({ data }) => {
    validateAddress(data.chain, data.address);
    return await issueNonce(data);
  });

export const verifyWalletSignIn = createServerFn({ method: "POST" })
  .inputValidator((input) => VerifyInput.parse(input))
  .handler(async ({ data }) => {
    validateAddress(data.chain, data.address);
    await verifySignedMessage(data);
    const session = await findOrCreateWalletUserAndMintSession({
      chain: data.chain,
      address: data.address,
    });
    return session;
  });

export const linkWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => VerifyInput.parse(input))
  .handler(async ({ data, context }) => {
    validateAddress(data.chain, data.address);
    await verifySignedMessage(data);
    await linkWalletToUser({
      userId: context.userId,
      chain: data.chain,
      address: data.address,
    });
    return { ok: true as const };
  });

export const getDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ chain: ChainSchema }).parse(input))
  .handler(async ({ data, context }) => {
    return await getOrCreateDepositAddressForUser({
      userId: context.userId,
      chain: data.chain,
    });
  });

export const listMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("deposits")
      .select(
        "id,chain,tx_hash,from_address,amount,token,confirmations,status,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  });

export const listMyWalletIdentities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("wallet_identities")
      .select("id,chain,address,verified_at")
      .order("verified_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });
