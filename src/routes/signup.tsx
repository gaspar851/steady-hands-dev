import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120, "Name too long"),
  phone: z.string().trim().regex(/^[+0-9 ()-]{6,32}$/, "Invalid phone number"),
  email: z.string().trim().toLowerCase().email("Invalid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password too long"),
});

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create profile — Open Trader" },
      { name: "description", content: "Sign up and create your profile." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", password: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    // Supabase returns a user with an empty `identities` array when the email
    // already exists (it does this silently to prevent email enumeration).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast.error("An account with this email already exists. Please sign in.");
      navigate({ to: "/login" });
      return;
    }
    // If email confirmation is required, no session is returned.
    if (!data.session) {
      toast.success("Account created. Please check your email to confirm, then sign in.");
      navigate({ to: "/login" });
      return;
    }
    toast.success(t("auth.account_created"));
    navigate({ to: "/trade" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back_home")}
        </Link>
        <Card className="w-full p-6">
        <div className="mb-6 flex items-center gap-2">
          <Logo size={36} withWordmark={false} />
          <div>
            <h1 className="text-base font-semibold">{t("auth.signup_title")}</h1>
          </div>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Field label={t("auth.full_name")}><Input required maxLength={120} value={form.full_name} onChange={set("full_name")} /></Field>
          <Field label={t("auth.phone")}><Input required maxLength={32} value={form.phone} onChange={set("phone")} /></Field>
          <Field label={t("auth.email")}><Input required type="email" autoComplete="email" maxLength={255} value={form.email} onChange={set("email")} /></Field>
          <Field label={t("auth.password")}><Input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>
          <Button type="submit" disabled={loading}>{loading ? t("common.creating") : t("common.create_account")}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("auth.have_account")} <Link to="/login" className="text-primary hover:underline">{t("common.sign_in")}</Link>
        </p>
      </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
