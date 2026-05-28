import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listKnowledgeEntries,
  upsertKnowledgeEntry,
  deleteKnowledgeEntry,
  type KnowledgeEntry,
} from "@/lib/knowledge.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/knowledge")({
  head: () => ({ meta: [{ title: "AI Knowledge Base — Open Trader" }] }),
  component: KnowledgeAdmin,
});

type Editable = {
  id?: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
};

const blank: Editable = { title: "", content: "", category: "", is_active: true };

function KnowledgeAdmin() {
  const list = useServerFn(listKnowledgeEntries);
  const upsert = useServerFn(upsertKnowledgeEntry);
  const del = useServerFn(deleteKnowledgeEntry);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => list(),
  });

  const [editing, setEditing] = useState<Editable | null>(null);

  const saveMut = useMutation({
    mutationFn: (e: Editable) =>
      upsert({
        data: {
          id: e.id,
          title: e.title,
          content: e.content,
          category: e.category || null,
          is_active: e.is_active,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = (row: KnowledgeEntry) => {
    saveMut.mutate({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category ?? "",
      is_active: !row.is_active,
    });
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:underline">
            ← Back to admin
          </Link>
          <h1 className="mt-1 text-xl font-semibold">AI Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            Entries here are fed to the home-page assistant. Toggle inactive to hide an entry without deleting it.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...blank })} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New entry
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No entries yet. Create your first one to teach the assistant.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Content preview</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data!.rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                  <td className="px-3 py-2 max-w-md truncate text-muted-foreground">{r.content}</td>
                  <td className="px-3 py-2 text-center">
                    <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() =>
                        setEditing({
                          id: r.id,
                          title: r.title,
                          content: r.content,
                          category: r.category ?? "",
                          is_active: r.is_active,
                        })
                      }
                      className="mr-1 rounded-md border border-border p-1.5 hover:bg-accent"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${r.title}"?`)) delMut.mutate(r.id);
                      }}
                      className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit entry" : "New entry"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="kb-title">Title</Label>
                <Input
                  id="kb-title"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. How leverage works"
                />
              </div>
              <div>
                <Label htmlFor="kb-cat">Category (optional)</Label>
                <Input
                  id="kb-cat"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="e.g. fees, getting-started"
                />
              </div>
              <div>
                <Label htmlFor="kb-content">Content</Label>
                <Textarea
                  id="kb-content"
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  rows={8}
                  placeholder="Explain this topic in plain language. The AI will use this verbatim as its knowledge."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="kb-active"
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label htmlFor="kb-active">Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing?.title || !editing?.content}
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
