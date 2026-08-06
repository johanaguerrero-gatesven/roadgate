# RoadGate

> Planificación de roadmaps de producto (Epics → Features → User Stories) validada contra la **capacidad real** de los equipos, trimestre a trimestre.

---

## 1. Descripción general del proyecto

**RoadGate** es una aplicación web para la gestión y priorización de roadmaps de producto. A diferencia de un backlog tradicional, RoadGate introduce el concepto de **"Gate"**: una iniciativa solo puede entrar en el roadmap si cumple los requisitos mínimos de priorización y esfuerzo, y siempre se contrasta contra la capacidad disponible del equipo en cada quarter.

Ideas clave:

- **Jerarquía de trabajo**: `Epic → Feature → User Story`. El esfuerzo se introduce en el nivel hoja y se acumula (roll-up) hacia los padres.
- **Planificación por quarter** (Q1–Q4), sin granularidad de sprint.
- **Motor de capacidad**: cada quarter compara esfuerzo asignado vs. capacidad (FTEs) y muestra el nivel de utilización con semáforo.
- **Multi-roadmap**: cada usuario puede tener varios roadmaps aislados en su cuenta.
- **Multi-idioma** (ES / EN) y exportación a Excel.
- **Arquitectura API-first**: el núcleo de negocio se expone como REST API pública (`/api/public/v1/*`) documentada con OpenAPI; el frontend de RoadGate es el primer consumidor de esa API.

### Estados visuales de utilización

| Color | Utilización | Significado |
|---|---|---|
| 🟢 Verde | 50 % – 100 % | Carga saludable |
| 🟡 Ámbar | < 50 % | Sub-utilizado |
| 🔴 Rojo | > 100 % | Sobrecargado |
| ⚪ Vacío | 0 % | Sin asignaciones |

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | **TanStack Start v1** (React 19, SSR + server functions) |
| Routing | **TanStack Router** (file-based, `src/routes`) |
| Data fetching | **TanStack Query v5** |
| Build tool | **Vite 7** |
| Lenguaje | **TypeScript 5.8** |
| Estilos | **Tailwind CSS v4** (tokens en `src/styles.css`) |
| Componentes UI | **shadcn/ui** + Radix UI + `lucide-react` |
| Gráficos | **Recharts** |
| Validación | **Zod** + React Hook Form |
| Notificaciones | **Sonner** |
| Backend / BaaS | **Lovable Cloud** (PostgreSQL + Auth + RLS) |
| API pública | REST v1 (`/api/public/v1/*`) + **OpenAPI 3.1** |
| Exportación | **SheetJS (`xlsx`)** |
| Testing unit / integration | **Vitest** + **@testing-library/react** + **jsdom** |
| Testing E2E | **Playwright** |
| Deploy | Cloudflare Workers (`wrangler.jsonc`) |

---

## 3. Instalación y ejecución

### Requisitos previos

- **Node.js 20+** (recomendado 22)
- **npm**, `pnpm` o `bun`

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/<tu-usuario>/roadgate.git
cd roadgate

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env   # y rellenar los valores (ver abajo)

# 4. Arrancar en modo desarrollo
npm run dev            # http://localhost:8080
```

### Variables de entorno

Crea un archivo `.env` en la raíz:

```env
VITE_SUPABASE_URL="https://<tu-proyecto>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<tu-publishable-key>"
VITE_SUPABASE_PROJECT_ID="<tu-project-id>"

SUPABASE_URL="https://<tu-proyecto>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<tu-publishable-key>"
SUPABASE_PROJECT_ID="<tu-project-id>"
```

> ⚠️ Las claves `publishable` / `anon` son públicas por diseño. **Nunca** subas al repositorio la `service_role key` ni la contraseña de la base de datos.

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR (puerto 8080) |
| `npm run build` | Build de producción |
| `npm run build:dev` | Build en modo desarrollo (útil para depurar SSR) |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm run format` | Formatea con Prettier |
| `npm run test` | Ejecuta la suite de tests unitarios e integración con Vitest |
| `npm run test:watch` | Ejecuta Vitest en modo observador |
| `npm run test:coverage` | Ejecuta Vitest con reporte de cobertura |
| `npm run test:e2e` | Ejecuta los tests E2E con Playwright |
| `npm run test:e2e:ui` | Ejecuta Playwright en modo UI |

### Base de datos

El esquema vive en `supabase/`. Tablas principales:

- `roadmaps` — un roadmap por fila, asociado a `user_id`.
- `roadmap_items` — Epics, Features y User Stories (`roadmap_id`, `parent_id`, `effort`, `priority`, `quarter`, `notes`).
- `roadmap_capacity` — capacidad (FTE) por quarter y roadmap.

Todas las tablas tienen **Row Level Security** activo con políticas `auth.uid() = user_id`, de modo que cada usuario solo ve y modifica sus propios datos.

---

## 4. Estructura del proyecto

La aplicación sigue una arquitectura **Hexagonal / Ports & Adapters**: el dominio y la lógica de negocio viven en `src/core/` sin dependencias de framework, mientras que TanStack Start, Lovable Cloud y la UI actúan como adaptadores alrededor de ese núcleo.

```text
roadgate/
├─ src/
│  ├─ core/                       # Dominio y casos de uso (framework-agnostic)
│  │  ├─ services/                # Roadmaps, items, capacity, stats, API keys
│  │  ├─ context.ts               # Contrato del contexto de ejecución
│  │  ├─ errors.ts                # Errores de dominio tipados
│  │  ├─ mappers.ts               # Mapeo entre DB y entidades de dominio
│  │  ├─ schemas.ts               # Validación con Zod
│  │  └─ index.ts                 # Fachada pública del core
│  │
│  ├─ routes/                     # Rutas (file-based routing)
│  │  ├─ __root.tsx               # Layout raíz, providers e i18n
│  │  ├─ index.tsx                # Landing pública
│  │  ├─ login.tsx                # Login + registro + captcha + 2FA
│  │  ├─ app.tsx                  # Dashboard del workspace (KPIs + recientes)
│  │  ├─ roadmaps.index.tsx       # Listado de roadmaps
│  │  ├─ roadmaps.new.tsx         # Creación de roadmap
│  │  ├─ roadmaps.$roadmapId.tsx  # Workspace: Backlog / Roadmap / Dashboard
│  │  ├─ settings.*.tsx           # Perfil, empresa, usuarios, billing, API keys
│  │  └─ api/public/v1/...        # Endpoints REST públicos (API-first)
│  │
│  ├─ features/roadmap/           # Módulo de roadmap (hooks + componentes)
│  │  ├─ components/               # BacklogPanel, RoadmapView, DashboardPanel, ...
│  │  ├─ hooks/                    # use-roadmap-board y lógica de UI
│  │  └─ constants.ts              # Constantes del dominio de roadmap
│  │
│  ├─ components/
│  │  ├─ ui/                      # shadcn/ui (button, dialog, table, ...)
│  │  ├─ SiteHeader.tsx           # Navegación principal
│  │  ├─ SiteFooter.tsx
│  │  ├─ AuthProviders.tsx        # Botones sociales (Google / Microsoft)
│  │  ├─ LanguageSwitcher.tsx     # Conmutador ES / EN
│  │  └─ Logo.tsx
│  │
│  ├─ lib/
│  │  ├─ api/                     # SDK del frontend para la API pública
│  │  │  ├─ http.ts                # Cliente HTTP autenticado
│  │  │  └─ roadgate.ts            # Funciones del SDK (roadmaps, items, ...)
│  │  ├─ rest/                    # Utilidades de los endpoints REST
│  │  │  ├─ context.ts             # Contexto de petición y autenticación
│  │  │  ├─ respond.ts             # Helpers de respuesta HTTP
│  │  │  └─ openapi.ts             # Especificación OpenAPI 3.1
│  │  ├─ roadmap.ts               # Modelo de dominio: roll-up, quarters, vista roadmap
│  │  ├─ roadmap.functions.ts     # Server functions legacy (CRUD + stats)
│  │  ├─ work-item-icons.tsx      # Iconos y colores por tipo de work item
│  │  ├─ export-xlsx.ts           # Exportación multi-hoja a Excel
│  │  ├─ i18n.tsx                 # Proveedor y diccionarios ES / EN
│  │  ├─ auth.ts / twofa.ts       # Sesión y segundo factor
│  │  └─ utils.ts
│  │
│  ├─ test/                       # Tests unitarios e integración
│  │  ├─ fake-db.ts                # Dobles en memoria para persistencia
│  │  ├─ render.tsx                # Utilidad de renderizado para DOM tests
│  │  ├─ setup-dom.ts              # Configuración global de jsdom
│  │  └─ rest-routes.test.ts       # Tests de endpoints REST
│  │
│  ├─ hooks/                      # use-auth, use-mobile
│  ├─ integrations/supabase/      # Clientes generados (no editar a mano)
│  ├─ styles.css                  # Tokens de diseño Tailwind v4
│  ├─ router.tsx / start.ts       # Bootstrap de TanStack Start
│  └─ server.ts                   # Entry SSR
│
├─ e2e/                           # Tests end-to-end con Playwright
│  ├─ public.spec.ts               # Smoke test de rutas públicas y API docs
│  └─ critical-flow.spec.ts        # Flujo crítico: login → roadmap → item
│
├─ supabase/                      # Configuración y migraciones
├─ playwright.config.ts             # Configuración de Playwright
├─ vite.config.ts
├─ wrangler.jsonc                 # Configuración de despliegue
└─ package.json
```

---

## 5. Funcionalidades principales

### Backlog (vista tipo Excel)
- Tabla editable en línea: **ID, título, tipo, padre, esfuerzo, prioridad, quarter y observaciones**.
- Selector de padre con **búsqueda tipo combobox** y restricciones de jerarquía (una US solo cuelga de una Feature, etc.).
- **Roll-up de esfuerzo**: el esfuerzo se captura en las hojas; los padres muestran la suma (Σ) y su campo queda bloqueado.
- Filtro por tipo de work item (Epics / Features / User Stories).
- Botón de **reset de datos demo** y creación de items con ID manual.

### Roadmap (vista por quarters)
- Tarjetas agrupadas por Q1–Q4 con KPIs de capacidad y utilización.
- **Drag & drop** de tarjetas entre quarters con recálculo instantáneo de KPIs y botón **Deshacer**.
- **Cascada padre→hijo**: mover un Epic arrastra a sus descendientes; se indica el porcentaje del Epic cubierto por el roadmap.
- **Auto roll-up de visualización**: si todos los descendientes comparten quarter se muestra el padre; si están repartidos se muestran los hijos.
- **PriorityPicker** interactivo con 5 estados (Muy alta, Alta, Media, Baja, Sin prioridad) e iconos.
- Sección **"Sin quarter asignado"** dividida por tipo, con selector de quarter que se habilita al asignar prioridad.
- **Validación de entrada al roadmap**: al soltar un item sin prioridad o sin esfuerzo se abre un diálogo para completarlo, y un aviso lista los Epics sin quarter.

### Dashboard
- Métricas desglosadas por roadmap con selector de filtro ("Ver métricas de:").
- Separación clara entre **Roadmap** (items asignados a quarters) y **Backlog** (items sin quarter).
- Barras de utilización anual y por quarter, con capacidad ajustable manualmente.
- Distribución de prioridades y conteos por tipo con tooltips explicativos.

### Multi-roadmap
- Listado con **abrir, renombrar y eliminar**.
- Cada roadmap aísla sus items y su capacidad.
- Dashboard con los roadmaps recientes o estado vacío con CTA de creación.

### Autenticación y seguridad
- Registro y login por email/contraseña sobre Lovable Cloud Auth.
- **Google OAuth**.
- **Captcha** textual en el registro y **2FA** (SMS / app autenticadora) opcional.
- **RLS** en todas las tablas: aislamiento estricto de datos por usuario.

### API e integraciones
- **REST API v1** pública en `/api/public/v1/*`: roadmaps, work items, capacity, stats y API keys.
- **OpenAPI 3.1** navegable en `/docs/api` y descargable en `/api/public/v1/openapi.json`.
- **API keys** con hash SHA-256, scopes (`roadmaps:read`, `roadmaps:write`) y revocación.
- El frontend consume la misma API que un integrador externo vía `src/lib/api/roadgate.ts`.

### Otros
- **i18n ES / EN** en toda la aplicación.
- **Exportación a Excel** multi-hoja (Epics, Features, User Stories).
- Diseño responsive con tokens semánticos y soporte de tema.

---
## 6. Usuario y contraseña de prueba

La aplicación incluye una cuenta demo disponible desde la pantalla de login (botón **"🚀 Probar Demo"** o rellenando las credenciales manualmente):

```
Email:    demo@roadgate.app
Password: demo1234
```

Notas:
- La cuenta se auto-aprovisiona la primera vez que se usa contra el proyecto de Lovable Cloud configurado.
- Los datos de la demo son compartidos por cualquiera que use esa cuenta: **no introduzcas información real o sensible**.
- Para trabajo real, crea una cuenta propia desde la pestaña **Crear cuenta**.

---

## 7. Despliegue

El proyecto se despliega sobre Cloudflare Workers a partir del build de producción:

```bash
npm run build
```

Los cambios de backend (migraciones, funciones de servidor) se aplican de forma inmediata; los cambios de frontend requieren un nuevo despliegue.


---

## 8. Licencia

© 2026 GATES · RoadGate. Todos los derechos reservados. 
Este software es propietario y no se concede ninguna licencia de uso, copia, modificación o distribución sin autorización expresa por escrito.

---

## 🎓 Entregables TFM (AI Development)

Para facilitar la corrección del Trabajo de Fin de Máster, a continuación se adjuntan los enlaces a los entregables requeridos:

- **Despliegue del proyecto:** [https://myroadgate.com](https://myroadgate.com )
- **Presentación (Slides):** Archivo `ROADGATE Presentación del Proyecto TFM.pdf` del repositorio
- **Vídeo explicativo:** [Enlace a YouTube / Drive]
