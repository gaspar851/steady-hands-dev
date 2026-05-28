import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DepositStatus = "pending" | "approved" | "rejected";

export interface PlatformWalletDTO {
  id: string;
  coin: string;
  network: string;
  address: string;
  memo: string | null;
  qr_image_url: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface DepositRequestDTO {
  id: string;
  user_id: string;
  user_email?: string | null;
  platform_wallet_id: string;
  coin: string;
  network: string;
  amount: number;
  tx_hash: string;
  from_address: string | null;
  proof_image_url: string | null;
  status: DepositStatus;
  reviewer_id: string | null;
  reviewer_note: string | null;
  credited_balance_event_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function requireAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(supabase, userId))) throw new Error("Admins only");
}

// ---------------- Public (authenticated) reads ----------------

export const listActivePlatformWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: PlatformWalletDTO[] }> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("platform_wallets")
      .select("*")
      .eq("is_active", true)
      .order("coin");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as PlatformWalletDTO[] };
  });

export const listMyDepositRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: DepositRequestDTO[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("deposit_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as DepositRequestDTO[] };
  });

// ---------------- User creates a request ----------------

const CreateInput = z.object({
  platform_wallet_id: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  tx_hash: z.string().trim().min(4).max(200),
  from_address: z.string().trim().max(200).optional().nullable(),
  proof_image_url: z.string().trim().max(1024).optional().nullable(),
});

export const createDepositRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateInput.parse(data))
  .handler(async ({ context, data }): Promise<DepositRequestDTO> => {
    const { supabase, userId } = context;
    const { data: wallet, error: wErr } = await supabase
      .from("platform_wallets")
      .select("id, coin, network, is_active")
      .eq("id", data.platform_wallet_id)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet || !wallet.is_active) throw new Error("Wallet not available");

    const { data: row, error } = await supabase
      .from("deposit_requests")
      .insert({
        user_id: userId,
        platform_wallet_id: wallet.id,
        coin: wallet.coin,
        network: wallet.network,
        amount: data.amount,
        tx_hash: data.tx_hash,
        from_address: data.from_address ?? null,
        proof_image_url: data.proof_image_url ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as DepositRequestDTO;
  });

// ---------------- Admin: list / review ----------------

const AdminListInput = z
  .object({ status: z.enum(["pending", "approved", "rejected"]).optional() })
  .optional();

export const adminListDepositRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => AdminListInput.parse(data))
  .handler(async ({ context, data }): Promise<{ rows: DepositRequestDTO[] }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    let q = supabase
      .from("deposit_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Attach email from profiles
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let emailById = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      emailById = new Map((profs ?? []).map((p: any) => [p.id, p.email]));
    }
    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        user_email: emailById.get(r.user_id) ?? null,
      })) as DepositRequestDTO[],
    };
  });

const ReviewInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().nullable(),
  amount: z.number().positive().max(1_000_000).optional(),
});

export const adminReviewDepositRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ReviewInput.parse(data))
  .handler(async ({ context, data }): Promise<DepositRequestDTO> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const patch: { status: "approved" | "rejected"; reviewer_note: string | null; amount?: number } = {
      status: data.action === "approve" ? "approved" : "rejected",
      reviewer_note: data.note ?? null,
    };
    if (data.action === "approve" && typeof data.amount === "number") {
      patch.amount = data.amount;
    }

    const { data: row, error } = await supabase
      .from("deposit_requests")
      .update(patch)
      .eq("id", data.id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as DepositRequestDTO;
  });

// ---------------- Admin: platform wallets CRUD ----------------

const UpsertWalletInput = z.object({
  id: z.string().uuid().optional(),
  coin: z.string().trim().min(1).max(20),
  network: z.string().trim().min(1).max(40),
  address: z.string().trim().min(4).max(200),
  memo: z.string().trim().max(200).optional().nullable(),
  qr_image_url: z.string().trim().max(1024).optional().nullable(),
  is_active: z.boolean().default(true),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const adminListPlatformWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: PlatformWalletDTO[] }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("platform_wallets")
      .select("*")
      .order("coin");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as PlatformWalletDTO[] };
  });

export const adminUpsertPlatformWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => UpsertWalletInput.parse(data))
  .handler(async ({ context, data }): Promise<PlatformWalletDTO> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const payload = {
      coin: data.coin.toUpperCase(),
      network: data.network.toLowerCase(),
      address: data.address,
      memo: data.memo ?? null,
      qr_image_url: data.qr_image_url ?? null,
      is_active: data.is_active,
      notes: data.notes ?? null,
    };
    const q = data.id
      ? supabase.from("platform_wallets").update(payload).eq("id", data.id).select("*").single()
      : supabase.from("platform_wallets").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row as PlatformWalletDTO;
  });

export const adminDeletePlatformWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabase.from("platform_wallets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
