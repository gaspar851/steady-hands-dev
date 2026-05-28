import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, LineChart, Users, Wallet } from "lucide-react";
import { Logo } from "@/components/Logo";
import { usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";



export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMyProfile);
  const { t } = useTranslation();

  // Wait for the Supabase session to hydrate before firing any server fn —
  // otherwise the bearer-token attacher sends no Authorization header and
  // requireSupabaseAuth throws "Unauthorized: No authorization header provided".
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setHasSession(!!session);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const { data, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    enabled: hasSession,
    retry: false,
  });

  useEffect(() => {
    if (error && /Profile not found/i.test(String((error as Error).message))) {
      (async () => {
        qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        navigate({ to: "/login" });
      })();
    }
  }, [error, qc, navigate]);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // On explicit sign-out: drop cached queries so polling stops firing
  // without a token, then kick to login. Do NOT react to INITIAL_SESSION —
  // it can briefly arrive with session=null before localStorage hydrates,
  // causing a spurious bounce right after login.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        qc.cancelQueries();
        qc.clear();
        navigate({ to: "/login" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, qc]);

  const isAdmin = !!data?.roles.includes("admin");

  const signOut = async () => {
    qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center gap-4 border-b border-border bg-card/40 px-4">
        <Link to="/" className="flex items-center">
          <Logo size={26} />
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/trade" icon={LineChart} active={pathname.startsWith("/trade")}>{t("nav.trade")}</NavLink>
          {isAdmin && (
            <>
              <NavLink to="/admin" icon={LayoutDashboard} active={pathname === "/admin" || pathname.startsWith("/admin/") && !pathname.startsWith("/admin/users")}>{t("nav.admin")}</NavLink>
              <NavLink to="/admin/users" icon={Users} active={pathname.startsWith("/admin/users")}>{t("nav.users")}</NavLink>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/wallet"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition",
              pathname.startsWith("/wallet")
                ? "bg-primary/15 text-primary"
                : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            <Wallet className="h-3.5 w-3.5" />
            Deposit Funds
          </Link>
          {data && (
            <div className="hidden text-right md:block">
              <div className="text-xs font-medium">{data.profile.full_name || data.profile.email}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{usd(Number(data.profile.balance))}</div>
            </div>
          )}
          {isAdmin && <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">{t("nav.admin_badge")}</span>}
          
          <Button variant="ghost" size="sm" onClick={signOut} aria-label={t("common.sign_out")}><LogOut className="h-3.5 w-3.5" /></Button>
        </div>
      </header>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, icon: Icon, active, children }: { to: string; icon: any; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}
