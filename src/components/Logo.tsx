import { Link } from "@tanstack/react-router";

export function Logo({ tagline = true }: { tagline?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <div className="relative h-9 w-9 rounded-lg bg-[var(--gradient-primary)] shadow-[var(--shadow-soft)] grid place-items-center text-primary-foreground font-bold">
        <span className="text-lg leading-none">R</span>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-background border-2 border-primary" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tracking-tight text-foreground">
          Road<span className="text-primary">Gate</span>
        </span>
        {tagline && (
          <span className="hidden sm:inline font-script text-primary/80 text-lg leading-none">
            by GATES
          </span>
        )}
      </div>
    </Link>
  );
}
