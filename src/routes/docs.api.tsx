/**
 * =============================================================================
 * Página pública de documentación de la API (Fase 5)
 * =============================================================================
 * Ruta `/docs/api`. Renderiza el contrato servido en
 * `/api/public/v1/openapi.json` con una referencia interactiva (Scalar).
 *
 * El visor se carga con `React.lazy` dentro de `<ClientOnly>`: manipula el DOM
 * y no debe evaluarse durante el SSR.
 */
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const ApiReferenceViewer = lazy(() => import("@/components/ApiReferenceViewer"));

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [
      { title: "RoadGate API v1 — Referencia REST para integradores" },
      {
        name: "description",
        content:
          "Documentación OpenAPI de la API pública de RoadGate: roadmaps, work items, capacidad, métricas y API keys.",
      },
      { property: "og:title", content: "RoadGate API v1 — Referencia REST" },
      {
        property: "og:description",
        content:
          "Contrato OpenAPI 3.1 de RoadGate: endpoints, esquemas, scopes y errores para integrar tu propio frontend.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiDocs,
});

function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-muted-foreground">
      Cargando la referencia de la API…
    </div>
  );
}

function ApiDocs() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="text-3xl font-semibold tracking-tight">RoadGate API v1</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Todo lo que hace RoadGate está disponible como API REST. Autentícate con una
              API key (<code className="rounded bg-muted px-1">rg_live_…</code>) creada en
              Ajustes → API keys y envíala en la cabecera{" "}
              <code className="rounded bg-muted px-1">Authorization: Bearer</code>.
            </p>
            <a
              href="/api/public/v1/openapi.json"
              className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              Descargar la especificación OpenAPI 3.1 (JSON)
            </a>
          </div>
        </div>
        <ClientOnly fallback={<Loading />}>
          <Suspense fallback={<Loading />}>
            <ApiReferenceViewer />
          </Suspense>
        </ClientOnly>
      </main>
      <SiteFooter />
    </div>
  );
}
