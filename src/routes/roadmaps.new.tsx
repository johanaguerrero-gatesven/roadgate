import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/hooks/use-auth";
import { createRoadmap } from "@/lib/api/roadgate";

export const Route = createFileRoute("/roadmaps/new")({
  head: () => ({ meta: [{ title: "Nuevo roadmap — RoadGate" }] }),
  component: NewRoadmapPage,
});

function defaultName() {
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `Hoja de ruta sin título · ${today}`;
}

function NewRoadmapPage() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(defaultName());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  if (!ready || !session) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || defaultName();
    setSubmitting(true);
    try {
      const { id } = await createRoadmap({ name: finalName });
      toast.success("Roadmap creado");
      navigate({ to: "/roadmaps/$roadmapId", params: { roadmapId: id } });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo crear el roadmap");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/roadmaps"><ArrowLeft className="h-4 w-4" /> Mis roadmaps</Link>
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground">Nuevo roadmap</h1>
        <p className="text-muted-foreground mt-1 mb-8">Dale un nombre. Podrás renombrarlo cuando quieras.</p>

        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="rm-name">Nombre del roadmap</Label>
            <Input
              id="rm-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Roadmap 2026"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="lg" disabled={submitting}>
              <Plus className="h-4 w-4" /> {submitting ? "Creando…" : "Crear roadmap"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/roadmaps">Cancelar</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
