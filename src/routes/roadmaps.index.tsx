import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Map, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/hooks/use-auth";
import {
  listRoadmaps, deleteRoadmap, renameRoadmap,
} from "@/lib/api/roadgate";

export const Route = createFileRoute("/roadmaps/")({
  head: () => ({ meta: [{ title: "Mis roadmaps — RoadGate" }] }),
  component: RoadmapsListPage,
});

type Row = {
  id: string; name: string; createdAt: string; updatedAt: string; itemCount: number;
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
}

function RoadmapsListPage() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  const reload = () => {
    listRoadmaps()
      .then((r) => setRows(r))
      .catch((e) => { console.error(e); toast.error("No se pudieron cargar los roadmaps"); });
  };

  useEffect(() => {
    if (!session?.userId) { setRows(null); return; }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  if (!ready || !session) return null;

  const startEdit = (r: Row) => { setEditing(r.id); setDraftName(r.name); };
  const cancelEdit = () => { setEditing(null); setDraftName(""); };
  const commitEdit = async (r: Row) => {
    const name = draftName.trim();
    if (!name || name === r.name) { cancelEdit(); return; }
    try {
      await renameRoadmap({ roadmapId: r.id, name });
      cancelEdit();
      reload();
    } catch (e) { console.error(e); toast.error("Error al renombrar"); }
  };
  const remove = async (r: Row) => {
    if (!window.confirm(`¿Eliminar el roadmap "${r.name}" y todos sus datos? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteRoadmap({ roadmapId: r.id });
      toast.success("Roadmap eliminado");
      reload();
    } catch (e) { console.error(e); toast.error("Error al eliminar"); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mis roadmaps</h1>
            <p className="text-muted-foreground mt-1">Todos los roadmaps de tu cuenta.</p>
          </div>
          <Button size="lg" asChild>
            <Link to="/roadmaps/new"><Plus className="h-4 w-4" /> Nuevo roadmap</Link>
          </Button>
        </div>

        {rows === null && (
          <div className="text-muted-foreground text-sm">Cargando…</div>
        )}
        {rows && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
            <Map className="h-10 w-10 mx-auto text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Aún no tienes roadmaps</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Crea tu primer roadmap para empezar a planificar.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/roadmaps/new"><Plus className="h-4 w-4" /> Crear roadmap</Link>
            </Button>
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  {editing === r.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(r);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-8"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => commitEdit(r)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Link
                      to="/roadmaps/$roadmapId"
                      params={{ roadmapId: r.id }}
                      className="text-lg font-semibold text-foreground hover:underline line-clamp-2"
                    >
                      {r.name}
                    </Link>
                  )}
                  <Map className="h-5 w-5 text-primary shrink-0" />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Creado el {formatDate(r.createdAt)} · {r.itemCount} ítems
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" asChild className="flex-1">
                    <Link to="/roadmaps/$roadmapId" params={{ roadmapId: r.id }}>Abrir</Link>
                  </Button>
                  {editing !== r.id && (
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)} title="Renombrar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(r)} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
