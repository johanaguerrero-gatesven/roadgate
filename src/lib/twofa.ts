// Client-side 2FA simulation (localStorage).
// In production replace with RoadGate backend + Supabase MFA / SMS provider.

export type TwoFAMethod = "off" | "sms" | "totp";

export type TwoFASettings = {
  method: TwoFAMethod;
  phone?: string;
  secret?: string; // TOTP base32 secret (simulated)
  enabledAt?: string;
};

const PENDING_KEY = "roadgate.twofa.pending";

function keyFor(email: string) {
  return `roadgate.twofa:${email.trim().toLowerCase()}`;
}

export function getTwoFA(email: string): TwoFASettings {
  if (typeof window === "undefined" || !email) return { method: "off" };
  try {
    const raw = localStorage.getItem(keyFor(email));
    return raw ? (JSON.parse(raw) as TwoFASettings) : { method: "off" };
  } catch {
    return { method: "off" };
  }
}

export function saveTwoFA(email: string, s: TwoFASettings) {
  localStorage.setItem(keyFor(email), JSON.stringify(s));
  window.dispatchEvent(new Event("roadgate:twofa"));
}

export function disableTwoFA(email: string) {
  saveTwoFA(email, { method: "off" });
}

// --- simulated code generation ---

// Generate a fake 6-digit code deterministically per session so the user can "see"
// it in a toast during the simulated flow.
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate a base32-looking secret for TOTP setup screen.
export function generateSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "";
  for (let i = 0; i < 32; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s.match(/.{1,4}/g)!.join(" ");
}

// otpauth URI used to render QR (we render the URI as a QR placeholder).
export function otpAuthUri(email: string, secret: string) {
  const cleanSecret = secret.replace(/\s+/g, "");
  return `otpauth://totp/RoadGate:${encodeURIComponent(email)}?secret=${cleanSecret}&issuer=RoadGate`;
}

// Pending login (between password ok and 2FA verified).
export type PendingLogin = { email: string; method: TwoFAMethod; code: string };

export function setPendingLogin(p: PendingLogin) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
}
export function getPendingLogin(): PendingLogin | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingLogin) : null;
  } catch {
    return null;
  }
}
export function clearPendingLogin() {
  sessionStorage.removeItem(PENDING_KEY);
}
