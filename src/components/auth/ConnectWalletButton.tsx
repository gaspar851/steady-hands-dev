import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import bs58 from "bs58";
import { supabase } from "@/integrations/supabase/client";
import { getWalletNonce, verifyWalletSignIn } from "@/lib/wallet.functions";
import { isAppKitConfigured } from "@/integrations/wallet/appkit";
import { Wallet } from "lucide-react";

/**
 * "Connect Wallet" button. Drops the user into Reown AppKit's wallet modal
 * (MetaMask, Trust, Rainbow, Coinbase, WalletConnect, Phantom, Solflare,
 * Backpack, ...), then runs the SIWE / SIWS sign-in handshake against the
 * server and hydrates a Supabase session.
 */
export function ConnectWalletButton({ redirectTo = "/trade" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const { open } = useAppKit();
  const account = useAppKitAccount();
  const evmProvider = useAppKitProvider<{
    request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
  }>("eip155");
  const solProvider = useAppKitProvider<{
    signMessage: (msg: Uint8Array) => Promise<{ signature: Uint8Array } | Uint8Array>;
  }>("solana");
  const fetchNonce = useServerFn(getWalletNonce);
  const verifyFn = useServerFn(verifyWalletSignIn);
  const [busy, setBusy] = useState(false);

  if (!isAppKitConfigured) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled
        title="Set VITE_REOWN_PROJECT_ID to enable wallet sign-in."
      >
        <Wallet className="mr-2 h-3.5 w-3.5" /> Wallet sign-in (setup pending)
      </Button>
    );
  }

  const runSignIn = async () => {
    if (!account.address) {
      await open();
      toast.info("Pick a wallet, then press Connect Wallet again.");
      return;
    }
    setBusy(true);
    try {
      const chain: "evm" | "solana" =
        account.embeddedWalletInfo || (evmProvider as unknown)
          ? "evm"
          : "solana";

      // Heuristic: if it's a base58 ~32-44 char string it's Solana; else EVM.
      const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(account.address);
      const detectedChain: "evm" | "solana" = isSolana ? "solana" : "evm";

      const { message } = await fetchNonce({
        data: {
          chain: detectedChain,
          address: account.address,
          origin: window.location.origin,
        },
      });

      let signature: string;
      if (detectedChain === "evm") {
        if (!evmProvider.request) throw new Error("EVM provider unavailable.");
        const sig = (await evmProvider.request({
          method: "personal_sign",
          params: [message, account.address],
        })) as string;
        signature = sig;
      } else {
        if (!solProvider.signMessage) throw new Error("Solana provider unavailable.");
        const sigResult = await solProvider.signMessage(
          new TextEncoder().encode(message),
        );
        const sigBytes =
          sigResult instanceof Uint8Array ? sigResult : sigResult.signature;
        signature = bs58.encode(sigBytes);
      }

      const session = await verifyFn({
        data: {
          chain: detectedChain,
          address: account.address,
          message,
          signature,
        },
      });

      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw new Error(error.message);

      toast.success(session.created ? "Wallet account created." : "Signed in.");
      navigate({ to: redirectTo });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet sign-in failed.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={runSignIn}
      disabled={busy}
    >
      <Wallet className="mr-2 h-3.5 w-3.5" />
      {busy
        ? "Signing…"
        : account.address
          ? `Sign in as ${account.address.slice(0, 6)}…${account.address.slice(-4)}`
          : "Connect Wallet"}
    </Button>
  );
}
