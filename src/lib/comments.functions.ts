import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CommentDTO } from "./types";

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tradeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ comments: CommentDTO[] }> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("trade_comments")
      .select("*")
      .eq("trade_id", data.tradeId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { comments: (rows ?? []) as CommentDTO[] };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tradeId: z.string().uuid(), text: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("trade_comments").insert({
      trade_id: data.tradeId, author_id: userId, text: data.text,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("trade_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
