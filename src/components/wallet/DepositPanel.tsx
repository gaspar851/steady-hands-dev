import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { getDepositAddress } from "@/lib/wallet.functions";

type Chain = "evm" | "solana";

const NETWORK_LABEL: Record<Chain, string> = {
  evm: "Ethereum (ERC-20 USDT)",
  solana: "Solana (SPL USDT)",
};

const NETWORK_NOTE: Record<Chain, string> = {
  evm: "Send USDT on Ethereum. Sending any other token or network will result in permanent loss.",
  solana: "Send USDT on Solana (SPL). Sending any other token or network will result in permanent loss.",
};

export function DepositPanel({ chain }: { chain: Chain }) {
  const fetchAddress = useServerFn(getDepositAddress);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["deposit-address", chain],
    queryFn: () => fetchAddress({ data: { chain } }),
    retry: 1,
  });

  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const renderedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.address || renderedFor.current === data.address) return;
    QRCode.toDataURL(data.address, { margin: 1, width: 200 })
      .then((src) => {
        setQrSrc(src);
        renderedFor.current = data.address;
      })
      .catch(() => setQrSrc(null));
  }, [data?.address]);

  const copy = async () => {
    if (!data?.address) return;
    await navigator.clipboard.writeText(data.address);
    toast.success("Address copied");
  };

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{NETWORK_LABEL[chain]}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{NETWORK_NOTE[chain]}</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating address…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {(error as Error).message}
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["deposit-address", chain] })}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {data?.address && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {qrSrc && (
            <img
              src={qrSrc}
              alt={`${chain} deposit QR`}
              className="rounded-md border border-border bg-white p-1"
              width={120}
              height={120}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-mono break-all text-xs">{data.address}</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={copy}
            >
              <Copy className="mr-1.5 h-3 w-3" /> Copy address
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
