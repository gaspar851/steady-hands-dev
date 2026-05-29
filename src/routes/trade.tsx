import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { TradeWorkspace } from "@/components/trade/TradeWorkspace";
import { getMyProfile } from "@/lib/profile.functions";
import type { ProfileDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LogOut, LayoutDashboard, LineChart, Users, Wallet } from "lucide-react";
import { usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trade")({
  head: () => ({
    meta: [
      { title: "Trade — Open Trader" },
      { name: "description", content: "Live crypto trading workspace. Browse the market, then sign in to open trades." },
    ],
  }),
  component: PublicTradePage,
});

const GUEST_PROFILE: ProfileDTO = {
  id: "",
  email: "guest@demo",
  full_name: "Guest",
  phone: "",
  balance: 10000 as any,
  starting_balance: 10000 as any,
  strategy_name: "Demo",
  archived: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function PublicTradePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMyProfile);

  // Track session state without forcing a redirect.
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setHasSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setHasSession(!!session);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const { data } = useQuery<{ profile: ProfileDTO; roles: string[] }>({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    enabled: hasSession === true,
    retry: false,
  });

  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isAdmin = !!data?.roles.includes("admin");
  const isGuest = hasSession === false;
  const profile = data?.profile ?? GUEST_PROFILE;

  const signOut = async () => {
    qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  // While we don't know session state yet, show a light shell to avoid flashes.
  if (hasSession === null) {
    return <div className="p-8 text-sm text-muted-foreground">{t("trade.loading_workspace")}</div>;
  }
  if (hasSession && !data) {
    return <div className="p-8 text-sm text-muted-foreground">{t("trade.loading_workspace")}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center gap-4 border-b border-border bg-card/40 px-4">
        <Link to="/" className="flex items-center">
          <Logo size={26} />
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/trade" icon={LineChart} active={pathname.startsWith("/trade")}>
            {t("nav.trade")}
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/admin" icon={LayoutDashboard} active={pathname === "/admin"}>{t("nav.admin")}</NavLink>
              <NavLink to="/admin/users" icon={Users} active={pathname.startsWith("/admin/users")}>{t("nav.users")}</NavLink>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {isGuest ? (
            <>
              <span className="hidden rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] uppercase text-yellow-300 md:inline">
                Demo · Guest
              </span>
              <Link to="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          ) : (
            <>
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
              {isAdmin && (
                <span className="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                  {t("nav.admin_badge")}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={signOut} aria-label={t("common.sign_out")}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </header>
      <main className="flex-1 min-w-0">
        <TradeWorkspace profile={profile} isGuest={isGuest} />
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
