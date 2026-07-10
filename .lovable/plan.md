# Plan: Alinear código con las reglas de negocio de Vidsigner Roadmap

## Estado tras auditoría

| Regla | Estado |
|---|---|
| 1. Jerarquía RoadGates (cascada EPIC→hijos) | Cumple |
| 2. Gate de Priorización (bloqueo sin prioridad) | Parcial |
| 3. Motor de cálculo reactivo | Cumple |
| 4. Semáforo 50 / 90 / 100 en Dashboard | Corregido (>100 rojo, <50 ámbar, resto verde) |

Sólo quedan **discrepancias reales en la Regla 2** y ajustes finos de UX en las Reglas 1 y 4.

---

## Cambios propuestos

### A. Regla 2 — Gate de Priorización estricto  *(prioridad alta)*

Hoy `handleDrop` (roadmap.tsx:663) abre un diálogo que permite rellenar prioridad+esfuerzo en el momento y seguir. Se comporta como "asistente", no como "bloqueo".

Ajustar a un bloqueo real:

1. Si el item no tiene `priority` al soltarlo en un Quarter → **rechazar** el movimiento con `toast.error("No se puede añadir al Roadmap sin prioridad", { description: "Define la prioridad en la vista de Backlog." })`. Sin diálogo asistente.
2. Añadir el mismo bloqueo en el selector `Q?` de la tarjeta del Roadmap y en el `<Select>` de Quarter de la vista Backlog (`updateOne` con patch `{ quarter }` cuando `q !== ""` y `!item.priority`).
3. El esfuerzo faltante deja de bloquear el drop (se calcula automáticamente para padres; para hojas mostramos un `⚠` visual y KPI, pero el ítem entra al Q). Coherente con "el gate es de priorización".

Motivo: la regla dice explícitamente "Bloquea cualquier intento... sin definir una prioridad". El esfuerzo no forma parte de ese gate.

### B. Regla 1 — Cascada no destructiva  *(prioridad media)*

`moveQuarter` sobreescribe el `quarter` de **todos** los descendientes al mover el padre. Es correcto en la primera asignación, pero destruye overrides manuales del usuario (una Feature que él movió a Q3 vuelve a Q2 si arrastra el Epic).

Ajuste: en `moveQuarter`, propagar el nuevo `quarter` sólo a los descendientes cuyo `quarter` actual coincida con el `quarter` anterior del padre (o esté vacío). Los hijos con override manual distinto quedan intactos.

Efecto colateral positivo: `buildRoadmapView` ya detecta hijos con Q distinto al padre y renderiza los hijos por separado (Regla 1 punto 3), así que la cobertura parcial se visualiza correctamente.

### C. Regla 4 — Etiquetas del semáforo  *(prioridad baja)*

Los umbrales ya son correctos (`>100` / `<50`). Falta alinear las traducciones de estado con el enunciado:

- `roadmap.status.ok` → "OK" (verde) — sin cambios
- `roadmap.status.under` → "Baja utilización" (< 50%, ámbar)
- `roadmap.status.overload` → "Sobrecarga" (> 100%, rojo)
- `roadmap.status.empty` → "Sin asignación" (0%)

Revisar `src/lib/i18n.tsx` y ajustar strings ES/EN si difieren.

### D. Verificación

- Reproducir en preview: arrastrar un Epic sin prioridad a Q1 → toast de error, no dialog.
- Mover Epic con hijos en Q2 (uno movido manualmente a Q3) a Q4 → el hijo manual sigue en Q3, el resto va a Q4.
- Cambiar `developers` en Capacity → utilización recalcula en la misma pintura.
- Comprobar colores: 40% ámbar, 80% verde, 120% rojo.

---

## Archivos a tocar

- `src/routes/roadmap.tsx` — `handleDrop`, `moveQuarter`, `updateOne`, selector Q de la tarjeta Roadmap.
- `src/lib/roadmap.ts` — refinar `moveQuarter`? No: la función vive en el route file. Sólo `roadmap.tsx`.
- `src/lib/i18n.tsx` — etiquetas `roadmap.status.*` si hace falta.

## Fuera de alcance

- No se toca el modelo de datos ni las columnas del Backlog.
- No se añaden nuevas rutas ni componentes.
- El diálogo de "completar antes de añadir" se elimina en favor del toast — no se sustituye por otro flujo.
