import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/logo-roadgate-mark.png";

export function Logo({ tagline = true, variant = "default" }: { tagline?: boolean; variant?: "default" | "light" }) {
  const isLight = variant === "light";
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <img
        src={logoMark}
        alt="RoadGate"
        width={40}
        height={40}
        className={`h-10 w-10 object-contain transition-transform group-hover:scale-105 ${isLight ? "brightness-0 invert" : ""}`}
      />
      <div className="flex items-baseline gap-2">
        <span className={`text-xl font-bold tracking-tight ${isLight ? "text-primary-foreground" : "text-foreground"}`}>
          Road<span className={isLight ? "" : "text-primary"}>Gate</span>
        </span>
        {tagline && (
          <span className={`hidden sm:inline font-script text-lg leading-none ${isLight ? "text-primary-foreground/85" : "text-primary/80"}`}>
            by GATES
          </span>
        )}
      </div>
    </Link>
  );
}
