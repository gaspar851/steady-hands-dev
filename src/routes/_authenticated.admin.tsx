import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminGate,
});

function AdminGate() {
  const navigate = useNavigate();
  const check = useServerFn(checkIsAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => check() });

  useEffect(() => {
    if (!isLoading && data && !data.isAdmin) navigate({ to: "/trade", replace: true });
  }, [data, isLoading, navigate]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Checking permissions…</div>;
  if (!data?.isAdmin) return null;
  return <Outlet />;
}
