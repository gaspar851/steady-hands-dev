import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WireTransferDetailDTO {
  id: string;
  country: string;
  currency: string;
  bank_name: string;
  account_name: string;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  routing_number: string | null;
  bank_address: string | null;
  reference_instructions: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admins only");
}

export const listActiveWireDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: WireTransferDetailDTO[] }> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("wire_transfer_details")
      .select("*")
      .eq("is_active", true)
      .order("country");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as WireTransferDetailDTO[] };
  });

export const adminListWireDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: WireTransferDetailDTO[] }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("wire_transfer_details")
      .select("*")
      .order("country");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as WireTransferDetailDTO[] };
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  country: z.string().trim().min(1).max(100),
  currency: z.string().trim().min(1).max(10).default("USD"),
  bank_name: z.string().trim().min(1).max(200),
  account_name: z.string().trim().min(1).max(200),
  account_number: z.string().trim().max(100).optional().nullable(),
  iban: z.string().trim().max(100).optional().nullable(),
  swift: z.string().trim().max(50).optional().nullable(),
  routing_number: z.string().trim().max(50).optional().nullable(),
  bank_address: z.string().trim().max(500).optional().nullable(),
  reference_instructions: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const adminUpsertWireDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpsertInput.parse(d))
  .handler(async ({ context, data }): Promise<WireTransferDetailDTO> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const payload = {
      country: data.country,
      currency: data.currency.toUpperCase(),
      bank_name: data.bank_name,
      account_name: data.account_name,
      account_number: data.account_number ?? null,
      iban: data.iban ?? null,
      swift: data.swift ?? null,
      routing_number: data.routing_number ?? null,
      bank_address: data.bank_address ?? null,
      reference_instructions: data.reference_instructions ?? null,
      notes: data.notes ?? null,
      is_active: data.is_active,
    };
    const q = data.id
      ? supabase.from("wire_transfer_details").update(payload).eq("id", data.id).select("*").single()
      : supabase.from("wire_transfer_details").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row as WireTransferDetailDTO;
  });

export const adminDeleteWireDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabase.from("wire_transfer_details").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
