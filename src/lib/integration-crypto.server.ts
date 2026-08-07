/**
 * =============================================================================
 * Cifrado de credenciales de integración (AES-256-GCM)
 * =============================================================================
 * Sólo se importa desde código servidor. La clave maestra vive en
 * INTEGRATION_SECRET_KEY (variable de entorno del backend) y se deriva a 32
 * bytes con SHA-256, de modo que el formato de la variable es indiferente.
 *
 * Formato almacenado: base64( iv(12) | ciphertext+tag ).
 */

async function masterKey(): Promise<CryptoKey> {
  const raw = process.env["INTEGRATION_SECRET_KEY"];
  if (!raw) throw new Error("INTEGRATION_SECRET_KEY is not set");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await masterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toBase64(out);
}

export async function decryptSecret(stored: string): Promise<string> {
  const key = await masterKey();
  const bytes = fromBase64(stored);
  const iv = bytes.subarray(0, 12);
  const ct = bytes.subarray(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}

/** Pista no sensible para que el usuario reconozca el token guardado. */
export function maskSecret(value: string): string {
  const tail = value.slice(-4);
  return `••••${tail}`;
}
