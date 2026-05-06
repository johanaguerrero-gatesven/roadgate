import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/use-auth";
import { clearSession } from "@/lib/auth";

export function SiteHeader() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">Inicio</Link>
          <a href="/#features" className="hover:text-foreground transition-colors">Producto</a>
          <a href="/#why" className="hover:text-foreground transition-colors">Por qué RoadGate</a>
        </nav>
        <div className="flex items-center gap-2">
          {ready && session ? (
            <>
              <Button variant="ghost" onClick={() => navigate({ to: "/app" })}>
                Ir al app
              </Button>
              <Button variant="outline" onClick={() => { clearSession(); navigate({ to: "/" }); }}>
                Cerrar sesión
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate({ to: "/login" })}>
                Iniciar sesión
              </Button>
              <Button onClick={() => navigate({ to: "/register" })}>
                Crear cuenta
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
