/**
 * Server-only wallet helpers.
 *
 * - SIWE / SIWS message construction and verification
 * - HD derivation of per-user deposit addresses (EVM + Solana)
 * - Supabase admin user creation + session minting for wallet sign-in
 *
 * NEVER import this file from a client-bundled module. It reads
 * SUPABASE_SERVICE_ROLE_KEY and WALLET_HD_SEED.
 */
import { createClient } from "@supabase/supabase-js";
import { SiweMessage } from "siwe";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import { keccak256, toHex, getAddress } from "viem";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Chain = "evm" | "solana";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function randomNonce(): string {
  // 16 bytes -> 32 hex chars. Cryptographically strong.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getDomain(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return "opentrader.app";
  }
}

/** Build the message a wallet must sign. */
export function buildSiweMessage(args: {
  address: string;
  origin: string;
  nonce: string;
  chainId?: number;
}): string {
  const domain = getDomain(args.origin);
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + NONCE_TTL_MS).toISOString();
  const siwe = new SiweMessage({
    domain,
    address: getAddress(args.address),
    statement: "Sign in to Open Trader.",
    uri: args.origin,
    version: "1",
    chainId: args.chainId ?? 1,
    nonce: args.nonce,
    issuedAt,
    expirationTime,
  });
  return siwe.prepareMessage();
}

export function buildSiwsMessage(args: {
  address: string;
  origin: string;
  nonce: string;
}): string {
  const domain = getDomain(args.origin);
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + NONCE_TTL_MS).toISOString();
  return [
    `${domain} wants you to sign in with your Solana account:`,
    args.address,
    "",
    "Sign in to Open Trader.",
    "",
    `URI: ${args.origin}`,
    `Version: 1`,
    `Chain: solana`,
    `Nonce: ${args.nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ].join("\n");
}

/** Persist a nonce row. Returns the message the wallet must sign. */
export async function issueNonce(args: {
  chain: Chain;
  address: string;
  origin: string;
  chainId?: number;
}): Promise<{ nonce: string; message: string }> {
  const nonce = randomNonce();
  const message =
    args.chain === "evm"
      ? buildSiweMessage({
          address: args.address,
          origin: args.origin,
          nonce,
          chainId: args.chainId,
        })
      : buildSiwsMessage({
          address: args.address,
          origin: args.origin,
          nonce,
        });

  const expires_at = new Date(Date.now() + NONCE_TTL_MS).toISOString();
  const { error } = await supabaseAdmin.from("wallet_nonces").insert({
    chain: args.chain,
    address: args.address,
    nonce,
    message,
    expires_at,
  });
  if (error) throw new Error(`Failed to persist nonce: ${error.message}`);
  return { nonce, message };
}

/** Verify a signed message. Throws on any mismatch. Returns the canonical address. */
export async function verifySignedMessage(args: {
  chain: Chain;
  address: string;
  message: string;
  signature: string;
}): Promise<string> {
  // 1. Look up the nonce row by message content.
  const { data: rows, error } = await supabaseAdmin
    .from("wallet_nonces")
    .select("id,message,expires_at,used_at,chain,address_lower")
    .eq("chain", args.chain)
    .eq("address_lower", args.address.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(`Nonce lookup failed: ${error.message}`);
  const row = (rows ?? []).find((r) => r.message === args.message);
  if (!row) throw new Error("Unknown or stale signing challenge.");
  if (row.used_at) throw new Error("Signing challenge already used.");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("Signing challenge expired.");
  }

  // 2. Verify the signature against the message.
  if (args.chain === "evm") {
    const siwe = new SiweMessage(args.message);
    const result = await siwe.verify({ signature: args.signature });
    if (!result.success) throw new Error("Invalid signature.");
    const recovered = getAddress(result.data.address);
    if (recovered.toLowerCase() !== args.address.toLowerCase()) {
      throw new Error("Signer does not match supplied address.");
    }
    // 3. Burn the nonce.
    await supabaseAdmin
      .from("wallet_nonces")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);
    return recovered;
  }

  // Solana: ed25519 verify
  const messageBytes = new TextEncoder().encode(args.message);
  const sigBytes = bs58.decode(args.signature);
  const pubBytes = bs58.decode(args.address);
  const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pubBytes);
  if (!ok) throw new Error("Invalid signature.");
  await supabaseAdmin
    .from("wallet_nonces")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);
  return args.address;
}

/** Build the synthetic email used as the Supabase auth primary key for wallet-only users. */
function walletSyntheticEmail(chain: Chain, address: string): string {
  return `${chain}-${address.toLowerCase()}@wallet.opentrader.local`;
}

/** Random password for wallet-only Supabase auth users. They never sign in with it. */
function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Find or create the Supabase auth user for this wallet, then mint a session
 * (access + refresh tokens) the browser can hand to supabase.auth.setSession.
 */
export async function findOrCreateWalletUserAndMintSession(args: {
  chain: Chain;
  address: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  user_id: string;
  created: boolean;
}> {
  // 1. Look up existing wallet_identities row.
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from("wallet_identities")
    .select("user_id")
    .eq("chain", args.chain)
    .eq("address_lower", args.address.toLowerCase())
    .maybeSingle();
  if (lookupErr) throw new Error(`Identity lookup failed: ${lookupErr.message}`);

  let userId: string;
  let created = false;
  const email = walletSyntheticEmail(args.chain, args.address);

  if (existing) {
    userId = existing.user_id;
  } else {
    // 2. Create the Supabase auth user.
    const { data: createRes, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          full_name: `${args.chain === "evm" ? "EVM" : "Solana"} wallet ${args.address.slice(0, 6)}…${args.address.slice(-4)}`,
          wallet_chain: args.chain,
          wallet_address: args.address,
        },
      });
    if (createErr || !createRes.user) {
      throw new Error(`User create failed: ${createErr?.message ?? "unknown"}`);
    }
    userId = createRes.user.id;
    created = true;

    // 3. Link the wallet identity.
    const { error: linkErr } = await supabaseAdmin
      .from("wallet_identities")
      .insert({
        user_id: userId,
        chain: args.chain,
        address: args.address,
      });
    if (linkErr) {
      throw new Error(`Wallet link failed: ${linkErr.message}`);
    }
  }

  // 4. Mint a magic-link token and exchange it for a session.
  const { data: linkRes, error: linkGenErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
  if (linkGenErr || !linkRes?.properties?.hashed_token) {
    throw new Error(
      `Session mint failed: ${linkGenErr?.message ?? "no hashed_token"}`,
    );
  }
  const token_hash = linkRes.properties.hashed_token;

  // Use an ephemeral non-admin client to verify the OTP and get tokens.
  const publicClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: sessionRes, error: verifyErr } =
    await publicClient.auth.verifyOtp({
      type: "magiclink",
      token_hash,
    });
  if (verifyErr || !sessionRes.session) {
    throw new Error(
      `Session verify failed: ${verifyErr?.message ?? "no session"}`,
    );
  }

  return {
    access_token: sessionRes.session.access_token,
    refresh_token: sessionRes.session.refresh_token,
    user_id: userId,
    created,
  };
}

/** Attach a wallet to an already-signed-in user. */
export async function linkWalletToUser(args: {
  userId: string;
  chain: Chain;
  address: string;
}): Promise<void> {
  // Reject if already taken by someone else.
  const { data: existing } = await supabaseAdmin
    .from("wallet_identities")
    .select("user_id")
    .eq("chain", args.chain)
    .eq("address_lower", args.address.toLowerCase())
    .maybeSingle();
  if (existing && existing.user_id !== args.userId) {
    throw new Error("This wallet is already linked to another account.");
  }
  if (existing) return;
  const { error } = await supabaseAdmin.from("wallet_identities").insert({
    user_id: args.userId,
    chain: args.chain,
    address: args.address,
  });
  if (error) throw new Error(`Link failed: ${error.message}`);
}

// ----------------------------------------------------------------------------
// HD derivation of per-user deposit addresses
// ----------------------------------------------------------------------------

function getMnemonic(): string {
  const m = process.env.WALLET_HD_SEED;
  if (!m) {
    throw new Error(
      "WALLET_HD_SEED is not configured. Set a 24-word BIP-39 mnemonic to enable deposit address derivation.",
    );
  }
  return m.trim();
}

function deriveEvmAddress(mnemonic: string, index: number): string {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  // BIP44: m/44'/60'/0'/0/index
  const child = root.derive(`m/44'/60'/0'/0/${index}`);
  if (!child.publicKey) throw new Error("HD derivation failed (EVM).");
  // EVM address = last 20 bytes of keccak256(uncompressed pubkey w/o 0x04 prefix).
  // @scure/bip32 returns a compressed pubkey; derive the uncompressed form via privateKey.
  if (!child.privateKey) throw new Error("Missing private key on HD child.");
  const { secp256k1 } = require("@noble/curves/secp256k1");
  const uncompressed = secp256k1.getPublicKey(child.privateKey, false);
  const hashed = keccak256(uncompressed.slice(1));
  const addr = `0x${hashed.slice(-40)}`;
  return getAddress(addr);
}

function deriveSolanaAddress(mnemonic: string, index: number): string {
  const seed = mnemonicToSeedSync(mnemonic);
  // Phantom-compatible derivation: m/44'/501'/index'/0'
  const path = `m/44'/501'/${index}'/0'`;
  const { key } = derivePath(path, Buffer.from(seed).toString("hex"));
  const kp = Keypair.fromSeed(key);
  return kp.publicKey.toBase58();
}

/** Find or create a user's deposit address for the requested chain. */
export async function getOrCreateDepositAddressForUser(args: {
  userId: string;
  chain: Chain;
}): Promise<{ address: string; chain: Chain }> {
  const { data: existing, error } = await supabaseAdmin
    .from("deposit_addresses")
    .select("address")
    .eq("user_id", args.userId)
    .eq("chain", args.chain)
    .maybeSingle();
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (existing) return { address: existing.address, chain: args.chain };

  // Compute next derivation_index for this chain.
  const { data: maxRow, error: maxErr } = await supabaseAdmin
    .from("deposit_addresses")
    .select("derivation_index")
    .eq("chain", args.chain)
    .order("derivation_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw new Error(`Index lookup failed: ${maxErr.message}`);
  const nextIndex = (maxRow?.derivation_index ?? -1) + 1;

  const mnemonic = getMnemonic();
  const address =
    args.chain === "evm"
      ? deriveEvmAddress(mnemonic, nextIndex)
      : deriveSolanaAddress(mnemonic, nextIndex);

  const { error: insertErr } = await supabaseAdmin
    .from("deposit_addresses")
    .insert({
      user_id: args.userId,
      chain: args.chain,
      address,
      derivation_index: nextIndex,
    });
  if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

  return { address, chain: args.chain };
}

/** Credit a confirmed deposit to a user's balance. Idempotent. */
export async function creditDepositIfConfirmed(depositId: string): Promise<void> {
  const { data: dep, error } = await supabaseAdmin
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .maybeSingle();
  if (error || !dep) return;
  if (dep.status === "credited") return;
  if (dep.status !== "confirmed") return;

  const { data: evt, error: evtErr } = await supabaseAdmin
    .from("balance_events")
    .insert({
      user_id: dep.user_id,
      actor_id: dep.user_id,
      type: "deposit",
      amount: dep.amount,
      note: `${dep.chain.toUpperCase()} ${dep.token} deposit · ${dep.tx_hash.slice(0, 10)}…`,
    })
    .select("id")
    .single();
  if (evtErr || !evt) throw new Error(`Credit event failed: ${evtErr?.message}`);

  // Update profile balance + mark deposit credited atomically via two writes
  // (RLS bypassed under service_role; guard_profile_balance allows because
  // auth.uid() is NULL for service_role).
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("balance")
    .eq("id", dep.user_id)
    .single();
  if (pErr) throw new Error(`Profile read failed: ${pErr.message}`);

  await supabaseAdmin
    .from("profiles")
    .update({ balance: Number(profile.balance) + Number(dep.amount) })
    .eq("id", dep.user_id);

  await supabaseAdmin
    .from("deposits")
    .update({ status: "credited", credited_balance_event_id: evt.id })
    .eq("id", depositId);
}
