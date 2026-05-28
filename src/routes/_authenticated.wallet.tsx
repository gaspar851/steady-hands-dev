import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { DepositPanel } from "@/components/wallet/DepositPanel";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";
import { listMyDeposits, listMyWalletIdentities } from "@/lib/wallet.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [{ title: "Wallet — Open Trader" }],
  }),
  component: WalletPage,
});

function WalletPage() {
  const fetchDeposits = useServerFn(listMyDeposits);
  const fetchIdentities = useServerFn(listMyWalletIdentities);
  const qc = useQueryClient();

  const deposits = useQuery({
    queryKey: ["my-deposits"],
    queryFn: () => fetchDeposits(),
  });
  const identities = useQuery({
    queryKey: ["my-wallets"],
    queryFn: () => fetchIdentities(),
  });

  // Realtime: refresh on any deposit row change.
  useEffect(() => {
    const ch = supabase
      .channel("deposits-self")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deposits" },
        () => qc.invalidateQueries({ queryKey: ["my-deposits"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-lg font-semibold">Wallet</h1>
        <p className="text-xs text-muted-foreground">
          Fund your trading balance by sending USDT to one of your deposit
          addresses below. Withdrawals coming soon.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <DepositPanel chain="evm" />
        <DepositPanel chain="solana" />
      </section>

      <section>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent deposits</h2>
          {deposits.isLoading && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {!deposits.isLoading && (deposits.data?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">
              No deposits yet. Send USDT to one of the addresses above; it will
              appear here once confirmed on-chain.
            </p>
          )}
          {(deposits.data?.length ?? 0) > 0 && (
            <ul className="divide-y divide-border text-xs">
              {deposits.data!.map((d) => (
                <li key={d.id} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2">
                  <span className="truncate font-mono">{d.tx_hash}</span>
                  <span className="font-mono">
                    {Number(d.amount).toFixed(2)} {d.token}
                  </span>
                  <span
                    className={
                      d.status === "credited"
                        ? "text-emerald-500"
                        : d.status === "confirmed"
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    }
                  >
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold">Linked wallets</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Wallets you can use to sign in to this account.
          </p>
          {(identities.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">
              No wallets linked yet.
            </p>
          ) : (
            <ul className="mb-3 space-y-1.5 text-xs font-mono">
              {identities.data!.map((w) => (
                <li key={w.id}>
                  <span className="uppercase text-muted-foreground">{w.chain}</span>{" "}
                  {w.address}
                </li>
              ))}
            </ul>
          )}
          <div className="max-w-xs">
            <ConnectWalletButton redirectTo="/wallet" />
          </div>
        </Card>
      </section>
    </div>
  );
}
