import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateTrade, closeTrade, reopenTrade, deleteTrade } from "@/lib/trades.functions";
import type { TradeDTO } from "@/lib/types";
import { getBookTicker } from "@/lib/binance";
import { feeOn, notionalOf } from "@/lib/costs";
import { toast } from "sonner";
import { Trash2, X, RotateCcw } from "lucide-react";


function dtLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTradeDialog({ trade, open, onOpenChange, isAdmin = false }: { trade: TradeDTO | null; open: boolean; onOpenChange: (v: boolean) => void; isAdmin?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const update = useServerFn(updateTrade);
  const close = useServerFn(closeTrade);
  const reopen = useServerFn(reopenTrade);
  const remove = useServerFn(deleteTrade);

  const applyReturnedBalance = (result: any) => {
    if (!result?.userId || result.newBalance == null) return;
    const updateCachedProfile = (old: any) => old?.profile
      ? { ...old, profile: { ...old.profile, balance: result.newBalance } }
      : old;
    if (!isAdmin) qc.setQueryData(["me"], updateCachedProfile);
    qc.setQueryData(["adminProfile", result.userId], updateCachedProfile);
  };

  const [form, setForm] = useState<any>(null);
  const [exitPrice, setExitPrice] = useState("");

  useEffect(() => {
    if (trade && (!form || form.id !== trade.id)) {
      setForm({
        id: trade.id,
        direction: trade.direction,
        entry_time: dtLocal(trade.entry_time),
        entry_price: String(trade.entry_price),
        position_size: String(trade.position_size),
        leverage: String(trade.leverage),
        stop_loss: trade.stop_loss != null ? String(trade.stop_loss) : "",
        take_profit: trade.take_profit != null ? String(trade.take_profit) : "",
        fees: String(trade.fees),
        swaps: String(trade.swaps),
        symbol: trade.symbol,
      });
      setExitPrice(trade.exit_price != null ? String(trade.exit_price) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade?.id]);

  const saveMutation = useMutation({
    mutationFn: () => update({
      data: {
        id: trade!.id,
        patch: {
          symbol: form.symbol,
          direction: form.direction,
          entry_time: new Date(form.entry_time).toISOString(),
          entry_price: +form.entry_price,
          position_size: +form.position_size,
          leverage: +form.leverage,
          stop_loss: form.stop_loss ? +form.stop_loss : null,
          take_profit: form.take_profit ? +form.take_profit : null,
          fees: +form.fees || 0,
          swaps: +form.swaps || 0,
        },
      },
    }),
    onSuccess: () => {
      toast.success(t("trade.et_toast_updated"));
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["adminProfile"] });
      qc.invalidateQueries({ queryKey: ["adminProfiles"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || t("trade.toast_failed")),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      let px = +exitPrice;
      // If admin/user didn't override, fetch market exit price = the side we sell back into:
      // long → sell into the bid; short → buy back at the ask.
      if (!px) {
        const bt = await getBookTicker(trade!.symbol);
        px = trade!.direction === "long" ? bt.bid : bt.ask;
      }
      const notional = notionalOf(Number(trade!.position_size), Number(trade!.leverage));
      const exit_fee = feeOn(notional);
      return close({ data: { id: trade!.id, exit_price: px, exit_fee } });
    },

    onSuccess: (result) => {
      const affectedUserId = result.userId ?? trade?.user_id;
      applyReturnedBalance(result);
      toast.success(t("trade.et_toast_closed"));
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["adminProfile", affectedUserId] });
      qc.invalidateQueries({ queryKey: ["adminProfiles"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || t("trade.toast_failed")),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopen({ data: { id: trade!.id } }),
    onSuccess: (result) => {
      const affectedUserId = result.userId ?? trade?.user_id;
      applyReturnedBalance(result);
      toast.success(t("trade.et_toast_reopened"));
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["adminProfile", affectedUserId] });
      qc.invalidateQueries({ queryKey: ["adminProfiles"] });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => remove({ data: { id: trade!.id } }),
    onSuccess: () => {
      toast.success(t("trade.et_toast_deleted"));
      qc.invalidateQueries({ queryKey: ["trades"] });
      onOpenChange(false);
    },
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f: any) => ({ ...f, [k]: e.target.value }));

  if (!trade || !form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isAdmin ? t("trade.et_title_admin") : t("trade.et_title_user")}<span className="font-mono">{trade.symbol}</span>
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? (trade.status === "open" ? t("trade.et_desc_admin_open") : t("trade.et_desc_admin_closed"))
              : (trade.status === "open" ? t("trade.et_desc_user_open") : t("trade.et_desc_user_closed"))}
          </DialogDescription>
        </DialogHeader>

        {isAdmin ? (
          <>
            <Tabs value={form.direction} onValueChange={(v) => setForm((f: any) => ({ ...f, direction: v }))}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="long" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">{t("trade.ot_long")}</TabsTrigger>
                <TabsTrigger value="short" className="data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive">{t("trade.ot_short")}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-2">
              <F label={t("trade.et_entry_time")}><Input type="datetime-local" value={form.entry_time} onChange={set("entry_time")} /></F>
              <F label={t("trade.ot_entry_price")}><Input type="number" step="any" value={form.entry_price} onChange={set("entry_price")} className="font-mono" /></F>
              <F label={t("trade.ot_size_usdt")}><Input type="number" step="any" value={form.position_size} onChange={set("position_size")} className="font-mono" /></F>
              <F label={t("trade.ot_leverage")}><Input type="number" step="any" value={form.leverage} onChange={set("leverage")} className="font-mono" /></F>
              <F label={t("trade.ot_stop_loss")}><Input type="number" step="any" value={form.stop_loss} onChange={set("stop_loss")} className="font-mono" /></F>
              <F label={t("trade.ot_take_profit")}><Input type="number" step="any" value={form.take_profit} onChange={set("take_profit")} className="font-mono" /></F>
              <F label={t("trade.ot_fees_usdt")}><Input type="number" step="any" value={form.fees} onChange={set("fees")} className="font-mono" /></F>
              <F label={t("trade.et_swaps")}><Input type="number" step="any" value={form.swaps} onChange={set("swaps")} className="font-mono" /></F>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <F label={t("trade.et_direction")}><Input value={form.direction.toUpperCase()} disabled className="font-mono" /></F>
            <F label={t("trade.ot_entry_price")}><Input value={form.entry_price} disabled className="font-mono" /></F>
            <F label={t("trade.ot_size_usdt")}><Input value={form.position_size} disabled className="font-mono" /></F>
            <F label={t("trade.ot_leverage")}><Input value={`${form.leverage}x`} disabled className="font-mono" /></F>
            <F label={t("trade.ot_stop_loss")}>
              <Input
                type="number"
                step="any"
                value={form.stop_loss}
                onChange={set("stop_loss")}
                disabled={trade.status !== "open"}
                className="font-mono"
              />
            </F>
            <F label={t("trade.ot_take_profit")}>
              <Input
                type="number"
                step="any"
                value={form.take_profit}
                onChange={set("take_profit")}
                disabled={trade.status !== "open"}
                className="font-mono"
              />
            </F>
          </div>
        )}


        {trade.status === "open" && (
          <div className="rounded-md border border-border p-3">
            <Label className="text-xs">{t("trade.et_close_at")}</Label>
            <div className="mt-1 flex gap-2">
              <Input type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} className="font-mono" />
              <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} variant="destructive">
                <X className="mr-1 h-3.5 w-3.5" />{t("trade.et_close_trade")}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-1">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate()}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />{t("trade.et_delete")}
              </Button>
            )}
            {isAdmin && trade.status === "closed" && (
              <Button variant="outline" size="sm" onClick={() => reopenMutation.mutate()}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />{t("trade.et_reopen")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("trade.et_close")}</Button>
            {(isAdmin || trade.status === "open") && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t("trade.et_save")}</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
