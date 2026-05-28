import { useState } from "react";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(72),
});

// Only allow same-origin relative paths to prevent open-redirect attacks.
function safeRedirect(target: string | undefined): string {
  if (!target || typeof target !== "string") return "/trade";
  if (!target.startsWith("/")) return "/trade";
  if (target.startsWith("//") || target.startsWith("/\\")) return "/trade";
  return target;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    // Use getUser() (validates JWT) instead of getSession() for trust decisions.
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) throw redirect({ to: "/trade" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Open Trader" },
      { name: "description", content: "Sign in to your Open Trader account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectParam } = Route.useSearch();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("auth.signed_in"));
    navigate({ to: safeRedirect(redirectParam) });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back_home")}
        </Link>
        <Card className="w-full p-6">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={36} withWordmark={false} />
          <div>
            <h1 className="text-base font-semibold">{t("auth.login_title")}</h1>
            <p className="text-xs text-muted-foreground">{t("auth.login_subtitle")}</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-xs">{t("auth.email")}</Label>
            <Input id="email" type="email" required autoComplete="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password" className="text-xs">{t("auth.password")}</Label>
            <Input id="password" type="password" required autoComplete="current-password" maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading}>{loading ? t("common.signing_in") : t("common.sign_in")}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("auth.no_account")} <Link to="/signup" className="text-primary hover:underline">{t("auth.create_strategy")}</Link>
        </p>
      </Card>
      </div>
    </div>
  );
}
