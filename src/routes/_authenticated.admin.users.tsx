import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllProfiles, setUserRole, setProfileArchived } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users — Open Trader Admin" }] }),
  component: UsersPage,
});

function UsersPage() {
  const list = useServerFn(listAllProfiles);
  const setRole = useServerFn(setUserRole);
  const archive = useServerFn(setProfileArchived);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["adminProfiles"], queryFn: () => list() });

  const roleMutation = useMutation({
    mutationFn: setRole,
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["adminProfiles"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const archiveMutation = useMutation({
    mutationFn: archive,
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["adminProfiles"] }); },
  });

  const rows = data?.rows ?? [];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-card/40 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Roles</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isAdmin = r.roles.includes("admin");
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.phone}</td>
                  <td className="px-3 py-2">{r.roles.join(", ") || "user"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {isAdmin ? (
                        <Button size="sm" variant="outline"
                          onClick={() => roleMutation.mutate({ data: { userId: r.id, role: "admin", grant: false } })}>
                          Demote
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline"
                          onClick={() => roleMutation.mutate({ data: { userId: r.id, role: "admin", grant: true } })}>
                          Promote to admin
                        </Button>
                      )}
                      <Button size="sm" variant="outline"
                        onClick={() => archiveMutation.mutate({ data: { userId: r.id, archived: !r.archived } })}>
                        {r.archived ? "Unarchive" : "Archive"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
