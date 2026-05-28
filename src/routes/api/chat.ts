import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { messages?: UIMessage[] };
          const messages = body.messages;
          if (!Array.isArray(messages)) {
            return new Response("Messages are required", { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response("AI service not configured", { status: 500 });
          }

          // Load active knowledge entries (admin client — public endpoint, no auth required)
          const supabaseUrl = process.env.SUPABASE_URL!;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const admin = createClient(supabaseUrl, serviceKey);
          const { data: entries } = await admin
            .from("knowledge_entries")
            .select("title, content, category")
            .eq("is_active", true)
            .order("category", { ascending: true });

          const knowledgeBlock =
            (entries ?? [])
              .map((e) => `## ${e.title}${e.category ? ` (${e.category})` : ""}\n${e.content}`)
              .join("\n\n") || "(No knowledge entries configured yet.)";

          const system = `You are the Open Trader assistant. You help visitors understand the Open Trader platform.

Rules:
- Answer using ONLY the knowledge base below.
- If the answer isn't covered, say so honestly and suggest signing up to explore the platform.
- Be concise, friendly, and clear. Use short paragraphs and bullet points where helpful.
- Never invent fees, features, or claims.
- Respond as the support assistant of a live trading platform. Do not describe the product as a demo, simulator, sandbox, or practice environment.
- Never claim that accounts are automatically credited, funded, or topped up with any starting balance (e.g. "10,000 USDT"). Users fund their own accounts via deposits.

KNOWLEDGE BASE:
${knowledgeBlock}`;

          const gateway = createLovableAiGatewayProvider(apiKey);
          const result = streamText({
            model: gateway("google/gemini-3-flash-preview"),
            system,
            messages: await convertToModelMessages(messages),
          });

          return result.toUIMessageStreamResponse();
        } catch (err) {
          console.error("/api/chat error", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          return new Response(`Chat error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
