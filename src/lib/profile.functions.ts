import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProfileDTO } from "./types";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ profile: ProfileDTO; roles: string[] }> => {
    const { supabase, userId } = context;
    const [{ data: profile, error }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Profile not found. Please sign out and sign up again.");
    return { profile: profile as ProfileDTO, roles: (roles ?? []).map((r: any) => r.role) };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      full_name: z.string().min(1).max(120).optional(),
      phone: z.string().max(40).optional(),
      strategy_name: z.string().min(1).max(120).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
