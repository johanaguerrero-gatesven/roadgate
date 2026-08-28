import { useEffect, useState } from "react";
import { fetchActiveTeam, type ActiveTeam } from "@/lib/api/roadgate";
import { useAuth } from "@/hooks/use-auth";

/**
 * Carga (y provisiona de forma idempotente) el equipo activo del usuario.
 * Fase I: sólo lectura del equipo; la UI todavía no gestiona miembros.
 */
export function useActiveTeam() {
  const { session } = useAuth();
  const [team, setTeam] = useState<ActiveTeam | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.userId) {
      setTeam(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchActiveTeam()
      .then((tm) => {
        if (!cancelled) setTeam(tm);
      })
      .catch((e) => {
        console.error("active team:", e);
        if (!cancelled) setTeam(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.userId]);

  return { team, loading, isTeamAdmin: team?.role === "admin" };
}
