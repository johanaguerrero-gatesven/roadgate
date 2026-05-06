import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground max-w-md">
            Roadmap de producto que respeta la capacidad real de tu equipo.
            Una iniciativa de <span className="text-foreground font-medium">GATES</span>.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} GATES. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
