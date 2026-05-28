import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProfileDTO, TradeDTO } from "./types";


async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admins only");
}

export interface AdminProfileRow extends ProfileDTO {
  open_count: number;
  closed_count: number;
  roles: string[];
}

export const listAllProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminProfileRow[] }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const [{ data: profiles }, { data: trades }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("trades").select("user_id, status"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const openCount = new Map<string, number>();
    const closedCount = new Map<string, number>();
    for (const t of trades ?? []) {
      if (t.status === "open") openCount.set(t.user_id, (openCount.get(t.user_id) ?? 0) + 1);
      else closedCount.set(t.user_id, (closedCount.get(t.user_id) ?? 0) + 1);
    }
    const rows: AdminProfileRow[] = (profiles ?? []).map((p: any) => ({
      ...(p as ProfileDTO),
      open_count: openCount.get(p.id) ?? 0,
      closed_count: closedCount.get(p.id) ?? 0,
      roles: rolesByUser.get(p.id) ?? [],
    }));
    return { rows };
  });

export const getProfileById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ profile: ProfileDTO; roles: string[] }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const [{ data: profile, error }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", data.userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", data.userId),
    ]);
    if (error || !profile) throw new Error(error?.message ?? "Not found");
    return { profile: profile as ProfileDTO, roles: (roles ?? []).map((r: any) => r.role) };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "user"]),
      grant: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    if (data.grant) {
      const { error } = await supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setProfileArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), archived: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabase.from("profiles").update({ archived: data.archived }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      full_name: z.string().min(1).max(120).optional(),
      phone: z.string().max(40).optional(),
      strategy_name: z.string().min(1).max(120).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { userId: target, ...patch } = data;
    const { error } = await supabase.from("profiles").update(patch).eq("id", target);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    return { isAdmin: !!data };
  });

export interface AdminOpenTradeRow extends TradeDTO {
  profile_email: string;
  profile_full_name: string;
  profile_strategy_name: string;
}

export const listAllOpenTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ trades: AdminOpenTradeRow[] }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const [{ data: trades, error }, { data: profiles }] = await Promise.all([
      supabase.from("trades").select("*").eq("status", "open").order("entry_time", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name, strategy_name"),
    ]);
    if (error) throw new Error(error.message);
    const pById = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const rows: AdminOpenTradeRow[] = (trades ?? []).map((t: any) => {
      const p = pById.get(t.user_id);
      return {
        ...(t as TradeDTO),
        profile_email: p?.email ?? "",
        profile_full_name: p?.full_name ?? "",
        profile_strategy_name: p?.strategy_name ?? "",
      };
    });
    return { trades: rows };
  });

