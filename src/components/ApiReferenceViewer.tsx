/**
 * Visor interactivo del contrato OpenAPI.
 * Vive en su propio módulo porque Scalar es una librería puramente de cliente:
 * la página lo carga con `React.lazy` dentro de `<ClientOnly>` para que nunca
 * se evalúe durante el SSR.
 */
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function ApiReferenceViewer() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/api/public/v1/openapi.json",
        hideDownloadButton: false,
        withDefaultFonts: false,
      }}
    />
  );
}
