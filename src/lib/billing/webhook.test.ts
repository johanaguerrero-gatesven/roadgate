/**
 * Fase 5 · Firma e idempotencia del webhook de suscripciones.
 */
import { describe, it, expect } from "vitest";
import { verifyWebhookSignature } from "./webhook.server";

const SECRET = "test-secret";

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ eventId: "evt_1", teamId: "t-1" });

  it("acepta una firma válida (con y sin prefijo sha256=)", async () => {
    const hex = await sign(body);
    expect(await verifyWebhookSignature(body, hex, SECRET)).toBe(true);
    expect(await verifyWebhookSignature(body, `sha256=${hex}`, SECRET)).toBe(true);
  });

  it("rechaza firma ausente, alterada o de otro cuerpo", async () => {
    const hex = await sign(body);
    expect(await verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(await verifyWebhookSignature(body, hex.replace(/.$/, "0"), SECRET)).toBe(false);
    expect(await verifyWebhookSignature(`${body} `, hex, SECRET)).toBe(false);
  });

  it("rechaza una firma hecha con otro secreto", async () => {
    const hex = await sign(body);
    expect(await verifyWebhookSignature(body, hex, "otro-secreto")).toBe(false);
  });
});
