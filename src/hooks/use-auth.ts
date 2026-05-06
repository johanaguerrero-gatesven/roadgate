import { useEffect, useState } from "react";
import { getSession, type Session } from "@/lib/auth";

export function useAuth() {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSessionState(getSession());
    setReady(true);
    const handler = () => setSessionState(getSession());
    window.addEventListener("roadgate:auth", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("roadgate:auth", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return { session, ready, isAuthenticated: !!session };
}
