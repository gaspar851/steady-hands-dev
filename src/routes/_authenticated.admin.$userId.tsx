import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfileById, adminUpdateProfile, setProfileArchived, setUserRole } from "@/lib/admin.functions";
import { TradeWorkspace } from "@/components/trade/TradeWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, Save, UserCog } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$userId")({
  component: AdminUserView,
});

function AdminUserView() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfileById);
  const updateProfile = useServerFn(adminUpdateProfile);
  const archiveFn = useServerFn(setProfileArchived);
  const roleFn = useServerFn(setUserRole);

  const { data, isLoading, error } = useQuery({
    queryKey: ["adminProfile", userId],
    queryFn: () => fetchProfile({ data: { userId } }),
  });

  const [form, setForm] = useState({ full_name: "", phone: "" });
  useEffect(() => {
    if (data?.profile) {
      setForm({
        full_name: data.profile.full_name ?? "",
        phone: data.profile.phone ?? "",
      });
    }
  }, [data?.profile]);

  const saveMutation = useMutation({
    mutationFn: () => updateProfile({ data: { userId, ...form } }),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["adminProfile", userId] });
      qc.invalidateQueries({ queryKey: ["adminProfiles"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => archiveFn({ data: { userId, archived } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminProfile", userId] });
      qc.invalidateQueries({ queryKey: ["adminProfiles"] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: (grant: boolean) => roleFn({ data: { userId, role: "admin", grant } }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["adminProfile", userId] });
      qc.invalidateQueries({ queryKey: ["adminProfiles"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="p-8 text-sm text-destructive">Could not load user.</div>;

  const isAdmin = data.roles.includes("admin");

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-2 text-xs">
        <Link to="/admin" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3 w-3" />Back to master
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-medium">{data.profile.full_name || data.profile.email}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1">
                <UserCog className="h-3.5 w-3.5" />Edit user
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-3">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Full name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="mr-1 h-3.5 w-3.5" />Save
                </Button>
                <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                  {isAdmin ? (
                    <Button size="sm" variant="outline" onClick={() => roleMutation.mutate(false)}>Demote admin</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => roleMutation.mutate(true)}>Promote to admin</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => archiveMutation.mutate(!data.profile.archived)}>
                    {data.profile.archived ? "Unarchive" : "Archive"}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <TradeWorkspace profile={data.profile} isAdminView />
    </div>
  );
}
