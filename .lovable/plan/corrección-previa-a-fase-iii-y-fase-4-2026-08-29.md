# Corrección previa a Fase III y Fase 4

## Objetivo
Cerrar las incidencias heredadas antes de avanzar: privilegios anónimos de invitaciones, edición segura de Capacity por Editors y validación real de permisos/offboarding con usuarios y equipos distintos.

## Cambios

1. **Eliminar el riesgo de pérdida de Capacity (P-1 / I-3)**
   - Aplicar una migración aditiva que convierta `roadmap_capacity` en una relación realmente única por `roadmap_id`, preservando la fila y valores existentes.
   - Sustituir el flujo no transaccional `DELETE + INSERT` por una escritura atómica sin ventana de pérdida.
   - Mantener la autorización por rol efectivo del roadmap: Admin y Editor escriben; Viewer y usuarios ajenos no.
   - Añadir pruebas de regresión para edición compartida, fallo de escritura y conservación de la capacidad previa.

2. **Cerrar privilegios anónimos de invitaciones (W-1)**
   - Revocar explícitamente todos los privilegios de `anon` y `PUBLIC` sobre `team_invitations`.
   - Mantener las políticas actuales para Team Admin autenticado y la aceptación segura mediante token hash.
   - Verificar que una solicitud anónima ya no obtiene `200 []`.

3. **Validar colaboración real (W-2)**
   - Probar con identidades reales: Admin, Editor y Viewer dentro del mismo equipo, además de un usuario de otro equipo.
   - Comprobar lectura/escritura por API y URL directa, retirada inmediata de acceso y bloqueo entre equipos.
   - Confirmar que manipular `localStorage` no altera roles ni permisos efectivos.

4. **Validar offboarding real (I-2)**
   - Comprobar en backend que no puede desactivarse al último Team Admin.
   - Comprobar que un administrador de roadmap no puede desactivarse antes de transferir todos sus roadmaps.
   - Tras transferencia, validar que la desactivación retira acceso inmediatamente y no elimina roadmap, items, capacity ni historial.

5. **Compatibilidad, rollback y cierre**
   - Incluir rollback documentado y seguro en la nueva migración.
   - Actualizar dobles de base de datos y pruebas REST/core sin cambiar la UI ni añadir funciones de fases posteriores.
   - Comparar conteos y valores de roadmaps, items, capacity e historial antes/después.
   - Ejecutar suite completa, comprobación de tipos, build, linter de base de datos y pruebas negativas RLS/API.

## Entrega
Tabla final con criterio, evidencia, resultado e incidencia; archivos modificados; migración y rollback; pruebas ejecutadas; impacto sobre Fase 4 y riesgos residuales. La fase no se aprobará si persiste riesgo de acceso cruzado o pérdida de datos.
