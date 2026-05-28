import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TradeDTO } from "./types";

function realizedPnl(trade: any, exitPrice: number): number {
  const leverage = Number(trade.leverage) > 0 ? Number(trade.leverage) : 1;
  const qty = (Number(trade.position_size) * leverage) / Number(trade.entry_price);
  const gross = trade.direction === "long"
    ? (exitPrice - Number(trade.entry_price)) * qty
    : (Number(trade.entry_price) - exitPrice) * qty;
  return gross - Number(trade.fees || 0) - Number(trade.swaps || 0);
}

const tradeInput = z.object({
  symbol: z.string().min(1).max(40),
  direction: z.enum(["long", "short"]),
  entry_time: z.string(),
  entry_price: z.number().positive(),
  position_size: z.number().positive(),
  leverage: z.number().positive().max(500),
  stop_loss: z.number().positive().nullable().optional(),
  take_profit: z.number().positive().nullable().optional(),
  fees: z.number().min(0).default(0),
  swaps: z.number().min(0).default(0),
  risk_pct: z.number().min(0).max(100).nullable().optional(),
});

async function assertOwnerOrAdmin(supabase: any, userId: string, targetUserId: string) {
  if (userId === targetUserId) return;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ trades: TradeDTO[] }> => {
    const { supabase, userId } = context;
    const target = data.userId ?? userId;
    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", target)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { trades: (trades ?? []) as TradeDTO[] };
  });

export const createTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tradeInput.extend({ userId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.userId ?? userId;
    await assertOwnerOrAdmin(supabase, userId, target);
    const { userId: _, ...rest } = data;
    const { data: row, error } = await supabase
      .from("trades")
      .insert({ ...rest, user_id: target, status: "open" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { trade: row as TradeDTO };
  });

export const updateTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      patch: tradeInput.partial().extend({
        status: z.enum(["open", "closed"]).optional(),
        exit_price: z.number().nullable().optional(),
        exit_time: z.string().nullable().optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("trades").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      exit_price: z.number().positive(),
      exit_time: z.string().optional(),
      exit_fee: z.number().min(0).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trade, error: tErr } = await supabase.from("trades").select("*").eq("id", data.id).single();
    if (tErr || !trade) throw new Error(tErr?.message ?? "Trade not found");
    if (trade.status === "closed") {
      const { data: profile } = await supabase.from("profiles").select("balance").eq("id", trade.user_id).single();
      return { net: 0, newBalance: Number(profile?.balance ?? 0), userId: trade.user_id };
    }

    const exitTime = data.exit_time ?? new Date().toISOString();
    const exitFee = Number(data.exit_fee ?? 0);
    const totalFees = Number(trade.fees || 0) + exitFee;
    // Recompute net with combined fees (entry + exit)
    const tradeWithFees = { ...trade, fees: totalFees };
    const net = realizedPnl(tradeWithFees, data.exit_price);

    const { data: closedRow, error: uErr } = await supabase.from("trades").update({
      status: "closed",
      exit_price: data.exit_price,
      exit_time: exitTime,
      fees: totalFees,
    }).eq("id", data.id).eq("status", "open").select("id").maybeSingle();
    if (uErr) throw new Error(uErr.message);
    if (!closedRow) {
      const { data: profile } = await supabase.from("profiles").select("balance").eq("id", trade.user_id).single();
      return { net: 0, newBalance: Number(profile?.balance ?? 0), userId: trade.user_id };
    }

    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", trade.user_id).single();
    const newBalance = Number(profile?.balance ?? 0) + net;
    const { error: bErr } = await supabaseAdmin.from("profiles").update({ balance: newBalance }).eq("id", trade.user_id);
    if (bErr) throw new Error(bErr.message);
    await supabase.from("balance_events").insert({
      user_id: trade.user_id,
      actor_id: userId,
      type: "trade",
      amount: net,
      note: `Closed ${trade.symbol} ${trade.direction.toUpperCase()}`,
    });

    return { net, newBalance, userId: trade.user_id };
  });


export const reopenTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trade } = await supabase.from("trades").select("*").eq("id", data.id).single();
    if (!trade || trade.status !== "closed" || trade.exit_price == null) return { ok: true };

    const net = realizedPnl(trade, Number(trade.exit_price));

    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", trade.user_id).single();
    const newBalance = Number(profile?.balance ?? 0) - net;
    const { error: bErr } = await supabaseAdmin.from("profiles").update({ balance: newBalance }).eq("id", trade.user_id);
    if (bErr) throw new Error(bErr.message);
    await supabase.from("balance_events").insert({
      user_id: trade.user_id,
      actor_id: userId,
      type: "trade",
      amount: -net,
      note: `Reopened ${trade.symbol}`,
    });
    await supabase.from("trades").update({
      status: "open",
      exit_price: null,
      exit_time: null,
    }).eq("id", data.id);
    return { ok: true, newBalance, userId: trade.user_id };
  });

export const deleteTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("trades").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
