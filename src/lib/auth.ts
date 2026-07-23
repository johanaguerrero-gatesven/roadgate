// Simple client-side auth using localStorage.
// NOTE: For production, replace with Lovable Cloud (Supabase) auth.

const USERS_KEY = "roadgate.users";
const SESSION_KEY = "roadgate.session";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type Session = {
  userId: string;
  email: string;
  name: string;
};

async function hash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("roadgate:auth"));
  // Also sign out from Supabase so useAuth doesn't restore the session.
  import("@/integrations/supabase/client")
    .then(({ supabase }) => supabase.auth.signOut())
    .catch(() => { /* ignore */ });
}

function setSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("roadgate:auth"));
}

export async function register(name: string, email: string, password: string) {
  const users = readUsers();
  const normalized = email.trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) {
    throw new Error("Ya existe una cuenta con ese email.");
  }
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalized,
    passwordHash: await hash(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  setSession({ userId: user.id, email: user.email, name: user.name });
}

export async function login(email: string, password: string) {
  const users = readUsers();
  const normalized = email.trim().toLowerCase();
  const user = users.find((u) => u.email === normalized);
  if (!user) throw new Error("Credenciales inválidas.");
  const ph = await hash(password);
  if (ph !== user.passwordHash) throw new Error("Credenciales inválidas.");
  setSession({ userId: user.id, email: user.email, name: user.name });
}

export function loginWithProvider(provider: "google" | "microsoft") {
  // Stub — to be wired with Lovable Cloud OAuth later.
  const fakeEmail = `demo+${provider}@roadgate.app`;
  setSession({
    userId: `${provider}-demo`,
    email: fakeEmail,
    name: provider === "google" ? "Demo Google" : "Demo Microsoft",
  });
}
