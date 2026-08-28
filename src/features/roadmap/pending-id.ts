/**
 * IDs pendientes de asignar.
 * Los items creados a mano durante la revisión del roadmap todavía no tienen
 * el ID definitivo (lo genera la herramienta de gestión de iteraciones), así
 * que nacen con un ID temporal reconocible y se marcan visualmente.
 */
export const PENDING_ID_PREFIX = "TBD-";

/** ¿El ID visible sigue siendo un marcador temporal? */
export const isPendingId = (id?: string) => !!id && id.startsWith(PENDING_ID_PREFIX);

/** Siguiente ID temporal libre (TBD-01, TBD-02, …). */
export function nextPendingId(usedIds: Iterable<string>): string {
  const used = new Set(usedIds);
  let n = 1;
  let candidate = `${PENDING_ID_PREFIX}${String(n).padStart(2, "0")}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${PENDING_ID_PREFIX}${String(n).padStart(2, "0")}`;
  }
  return candidate;
}
