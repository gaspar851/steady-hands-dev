import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BalanceEventDTO } from "./types";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admins only");
}

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      type: z.enum(["add", "remove", "reset", "adjust"]),
      amount: z.number(),
      note: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const { data: profile, error: pErr } = await supabase.from("profiles").select("balance, starting_balance").eq("id", data.userId).single();
    if (pErr || !profile) throw new Error(pErr?.message ?? "Profile not found");

    let delta = data.amount;
    let newBalance = Number(profile.balance);
    let newStarting = Number(profile.starting_balance);

    if (data.type === "add") {
      newBalance += data.amount;
      newStarting += data.amount;
    } else if (data.type === "remove") {
      delta = -Math.abs(data.amount);
      newBalance -= Math.abs(data.amount);
      newStarting -= Math.abs(data.amount);
    } else if (data.type === "reset") {
      delta = data.amount - newBalance;
      newBalance = data.amount;
      newStarting = data.amount;
    } else if (data.type === "adjust") {
      delta = data.amount - newBalance;
      newBalance = data.amount;
    }

    await supabase.from("profiles").update({ balance: newBalance, starting_balance: newStarting }).eq("id", data.userId);
    await supabase.from("balance_events").insert({
      user_id: data.userId,
      actor_id: userId,
      type: data.type,
      amount: delta,
      note: data.note ?? null,
    });
    return { newBalance };
  });

export const listBalanceEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ events: BalanceEventDTO[] }> => {
    const { supabase, userId } = context;
    const target = data.userId ?? userId;
    const { data: events, error } = await supabase
      .from("balance_events")
      .select("*")
      .eq("user_id", target)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { events: (events ?? []) as BalanceEventDTO[] };
  });
