import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSession, type Session } from "@/lib/auth";

export function useAuth() {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const toSession = (u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): Session | null => {
      if (!u) return null;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name = (meta.full_name as string) || (meta.name as string) || (u.email ?? "").split("@")[0] || "User";
      return { userId: u.id, email: u.email ?? "", name };
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSessionState(toSession(data.session?.user ?? null));
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSessionState(toSession(s?.user ?? null));
      setReady(true);
      if (!s) {
        // Clear any legacy localStorage session so the app doesn't think we're logged in.
        try { clearSession(); } catch { /* ignore */ }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, isAuthenticated: !!session };
}
