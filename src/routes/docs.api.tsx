/**
 * =============================================================================
 * Página pública de documentación de la API (Fase 5)
 * =============================================================================
 * Ruta `/docs/api`. Renderiza el contrato de `/api/public/v1/openapi.json` con
 * Scalar (referencia interactiva) cargado desde CDN sólo en cliente: es una
 * librería que manipula el DOM y no debe ejecutarse durante el SSR.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

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

const SCALAR_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.28/dist/browser/standalone.js";

function ApiDocs() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Scalar lee la configuración de un <script type="application/json"> con
    // id `api-reference` y monta la referencia en su lugar.
    const config = document.createElement("script");
    config.id = "api-reference";
    config.type = "application/json";
    config.textContent = JSON.stringify({
      url: "/api/public/v1/openapi.json",
      theme: "default",
      hideDownloadButton: false,
    });
    containerRef.current?.appendChild(config);

    const script = document.createElement("script");
    script.src = SCALAR_CDN;
    script.async = true;
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);

    return () => {
      config.remove();
      script.remove();
    };
  }, []);

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
        {failed && (
          <div className="mx-auto max-w-6xl px-6 py-10 text-muted-foreground">
            No se pudo cargar el visor interactivo. Puedes usar la especificación en crudo
            desde el enlace anterior.
          </div>
        )}
        <div ref={containerRef} />
      </main>
      <SiteFooter />
    </div>
  );
}
