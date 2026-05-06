import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type Locale = "es" | "en";

const STORAGE_KEY = "roadgate.locale";

const dict = {
  es: {
    "nav.home": "Inicio",
    "nav.product": "Producto",
    "nav.why": "Por qué RoadGate",
    "nav.goApp": "Ir al app",
    "nav.signOut": "Cerrar sesión",
    "nav.signIn": "Iniciar sesión",
    "nav.signUp": "Crear cuenta",
    "lang.label": "Idioma",
    "lang.es": "Español",
    "lang.en": "English",

    "home.badge": "Una iniciativa de GATES",
    "home.h1.a": "El roadmap que",
    "home.h1.script": "respeta",
    "home.h1.b": "la capacidad real de tu equipo.",
    "home.lead":
      "RoadGate combina la planificación visual de un roadmap moderno con la realidad operativa de tu equipo: disponibilidad, foco y compromisos.",
    "home.cta.primary": "Crear cuenta gratis",
    "home.cta.secondary": "Ya tengo una cuenta",
    "home.cta.fineprint": "Sin tarjeta de crédito · Acceso inmediato",

    "home.card.title": "Roadmap Q3 — Producto Atlas",
    "home.card.capacity": "Capacidad: 78%",
    "home.card.row1": "Onboarding rediseñado",
    "home.card.row2": "API pública v2",
    "home.card.row3": "Panel de métricas",
    "home.card.row4": "Integraciones SSO",
    "home.card.sprint": "Sprint 4–6",
    "home.card.team": "Equipo: 6 personas · 4.2 FTE disponibles",
    "home.card.realistic": "Realista ✓",
    "home.card.balanced": "Capacidad balanceada",

    "home.features.h2": "Planifica como un Product Manager. Entrega como un equipo real.",
    "home.features.lead":
      "Inspirado en las mejores prácticas de roadmapping, con una diferencia clave: cada iniciativa se contrasta contra la capacidad real de tu equipo.",
    "home.features.f1.title": "Roadmap visual",
    "home.features.f1.desc":
      "Vista timeline y swimlane para comunicar prioridades a stakeholders sin ambigüedad.",
    "home.features.f2.title": "Capacidad por equipo",
    "home.features.f2.desc":
      "Define FTEs, foco y disponibilidad. RoadGate avisa cuando comprometes más de lo posible.",
    "home.features.f3.title": "Iteraciones realistas",
    "home.features.f3.desc":
      "Convierte iniciativas en sprints u OKRs trimestrales sin perder la visión global.",

    "home.why.kicker": "¿Por qué RoadGate?",
    "home.why.h2": "Porque un roadmap sin capacidad es solo una lista de deseos.",
    "home.why.lead":
      "Con la experiencia de GATES integrando equipos tech Senior en LATAM, sabemos que entregar a tiempo no es un tema de optimismo: es un tema de visibilidad sobre la capacidad real.",
    "home.why.s1": "predictibilidad de entrega",
    "home.why.s2": "compromisos por encima de capacidad",
    "home.why.s3": "para producto, ingeniería y dirección",
    "home.why.s4": "ajuste de roadmap por capacidad",
    "home.why.s3.k": "1 vista",
    "home.why.s4.k": "Tiempo real",

    "home.cta2.h2": "Empieza a planificar con la realidad de tu equipo",
    "home.cta2.lead": "Crea tu cuenta y arma tu primer roadmap en minutos.",
    "home.cta2.primary": "Crear cuenta",
    "home.cta2.secondary": "Iniciar sesión",

    "footer.tagline": "Roadmap de producto que respeta la capacidad real de tu equipo. Una iniciativa de",
    "footer.rights": "Todos los derechos reservados.",

    "auth.shell.tagline": "Tu puerta al roadmap realista.",
    "auth.shell.h2": "Planifica con visión. Entrega con la capacidad real de tu equipo.",
    "auth.shell.lead": "RoadGate es la iniciativa de GATES para llevar el roadmapping a un siguiente nivel.",

    "login.title": "Bienvenido de vuelta",
    "login.subtitle": "Inicia sesión para continuar con tu roadmap.",
    "login.divider": "o con email",
    "login.email": "Email",
    "login.password": "Contraseña",
    "login.submit": "Iniciar sesión",
    "login.submitting": "Entrando…",
    "login.noAccount": "¿No tienes cuenta?",
    "login.createOne": "Crear una cuenta",
    "login.success": "Bienvenido de vuelta 👋",
    "login.errorGeneric": "Error al iniciar sesión",
    "login.meta.title": "Iniciar sesión — RoadGate",
    "login.meta.desc": "Accede a tu cuenta de RoadGate.",

    "register.title": "Crea tu cuenta",
    "register.subtitle": "Empieza gratis. Sin tarjeta de crédito.",
    "register.divider": "o regístrate con email",
    "register.name": "Nombre",
    "register.namePh": "Tu nombre",
    "register.passwordPh": "Mínimo 6 caracteres",
    "register.submit": "Crear cuenta",
    "register.submitting": "Creando cuenta…",
    "register.terms": "Al continuar aceptas nuestros términos y política de privacidad.",
    "register.haveAccount": "¿Ya tienes cuenta?",
    "register.signIn": "Iniciar sesión",
    "register.success": "¡Cuenta creada! Bienvenido a RoadGate 🚀",
    "register.errorGeneric": "Error al registrar",
    "register.meta.title": "Crear cuenta — RoadGate",
    "register.meta.desc": "Crea tu cuenta de RoadGate y empieza a planificar tu roadmap.",

    "validation.emailInvalid": "Email inválido",
    "validation.passwordMin": "Mínimo 6 caracteres",
    "validation.nameMin": "Mínimo 2 caracteres",

    "auth.providers.google": "Continuar con Google",
    "auth.providers.microsoft": "Continuar con Microsoft",
    "auth.providers.toast": "SSO se habilitará al activar el backend. Entrando como demo…",

    "app.greeting": "Hola,",
    "app.h1": "Tu espacio de roadmap",
    "app.lead": "Próximamente podrás crear y gestionar tus roadmaps aquí.",
    "app.new": "Nuevo roadmap",
    "app.stats.roadmaps": "Roadmaps",
    "app.stats.roadmaps.hint": "Crea tu primer roadmap",
    "app.stats.teams": "Equipos",
    "app.stats.teams.hint": "Define quiénes ejecutan",
    "app.stats.capacity": "Capacidad disponible",
    "app.stats.capacity.hint": "Configura FTEs por equipo",
    "app.empty.h2": "Aún no hay roadmaps",
    "app.empty.lead":
      "En la siguiente iteración podrás crear iniciativas, asignarlas a equipos y validar contra la capacidad real.",
    "app.meta.title": "Mi espacio — RoadGate",

    "404.h1": "404",
    "404.h2": "Página no encontrada",
    "404.lead": "La página que buscas no existe o fue movida.",
    "404.home": "Ir al inicio",

    "error.h1": "Esta página no se cargó",
    "error.lead": "Algo salió mal. Puedes reintentar o volver al inicio.",
    "error.retry": "Reintentar",
    "error.home": "Ir al inicio",
  },
  en: {
    "nav.home": "Home",
    "nav.product": "Product",
    "nav.why": "Why RoadGate",
    "nav.goApp": "Open app",
    "nav.signOut": "Sign out",
    "nav.signIn": "Sign in",
    "nav.signUp": "Sign up",
    "lang.label": "Language",
    "lang.es": "Español",
    "lang.en": "English",

    "home.badge": "A GATES initiative",
    "home.h1.a": "The roadmap that",
    "home.h1.script": "respects",
    "home.h1.b": "your team's real capacity.",
    "home.lead":
      "RoadGate combines the visual planning of a modern roadmap with the operational reality of your team: availability, focus, and commitments.",
    "home.cta.primary": "Create free account",
    "home.cta.secondary": "I already have an account",
    "home.cta.fineprint": "No credit card · Instant access",

    "home.card.title": "Q3 Roadmap — Atlas Product",
    "home.card.capacity": "Capacity: 78%",
    "home.card.row1": "Redesigned onboarding",
    "home.card.row2": "Public API v2",
    "home.card.row3": "Metrics dashboard",
    "home.card.row4": "SSO integrations",
    "home.card.sprint": "Sprint 4–6",
    "home.card.team": "Team: 6 people · 4.2 FTE available",
    "home.card.realistic": "Realistic ✓",
    "home.card.balanced": "Balanced capacity",

    "home.features.h2": "Plan like a Product Manager. Ship like a real team.",
    "home.features.lead":
      "Inspired by the best roadmapping practices, with one key difference: every initiative is checked against your team's real capacity.",
    "home.features.f1.title": "Visual roadmap",
    "home.features.f1.desc":
      "Timeline and swimlane views to communicate priorities to stakeholders without ambiguity.",
    "home.features.f2.title": "Team capacity",
    "home.features.f2.desc":
      "Define FTEs, focus, and availability. RoadGate warns you when you commit beyond what's possible.",
    "home.features.f3.title": "Realistic iterations",
    "home.features.f3.desc":
      "Turn initiatives into sprints or quarterly OKRs without losing the big picture.",

    "home.why.kicker": "Why RoadGate?",
    "home.why.h2": "Because a roadmap without capacity is just a wishlist.",
    "home.why.lead":
      "With GATES' experience integrating Senior tech teams across LATAM, we know that delivering on time isn't about optimism — it's about visibility into real capacity.",
    "home.why.s1": "delivery predictability",
    "home.why.s2": "over-capacity commitments",
    "home.why.s3": "for product, engineering and leadership",
    "home.why.s4": "roadmap adjustment by capacity",
    "home.why.s3.k": "1 view",
    "home.why.s4.k": "Real-time",

    "home.cta2.h2": "Start planning with your team's reality",
    "home.cta2.lead": "Create your account and build your first roadmap in minutes.",
    "home.cta2.primary": "Sign up",
    "home.cta2.secondary": "Sign in",

    "footer.tagline": "A product roadmap that respects your team's real capacity. An initiative by",
    "footer.rights": "All rights reserved.",

    "auth.shell.tagline": "Your gateway to a realistic roadmap.",
    "auth.shell.h2": "Plan with vision. Deliver with your team's real capacity.",
    "auth.shell.lead": "RoadGate is GATES' initiative to take roadmapping to the next level.",

    "login.title": "Welcome back",
    "login.subtitle": "Sign in to continue with your roadmap.",
    "login.divider": "or with email",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.submitting": "Signing in…",
    "login.noAccount": "Don't have an account?",
    "login.createOne": "Create one",
    "login.success": "Welcome back 👋",
    "login.errorGeneric": "Sign-in error",
    "login.meta.title": "Sign in — RoadGate",
    "login.meta.desc": "Access your RoadGate account.",

    "register.title": "Create your account",
    "register.subtitle": "Start free. No credit card.",
    "register.divider": "or sign up with email",
    "register.name": "Name",
    "register.namePh": "Your name",
    "register.passwordPh": "At least 6 characters",
    "register.submit": "Sign up",
    "register.submitting": "Creating account…",
    "register.terms": "By continuing you accept our terms and privacy policy.",
    "register.haveAccount": "Already have an account?",
    "register.signIn": "Sign in",
    "register.success": "Account created! Welcome to RoadGate 🚀",
    "register.errorGeneric": "Sign-up error",
    "register.meta.title": "Sign up — RoadGate",
    "register.meta.desc": "Create your RoadGate account and start planning your roadmap.",

    "validation.emailInvalid": "Invalid email",
    "validation.passwordMin": "At least 6 characters",
    "validation.nameMin": "At least 2 characters",

    "auth.providers.google": "Continue with Google",
    "auth.providers.microsoft": "Continue with Microsoft",
    "auth.providers.toast": "SSO will be enabled once the backend is active. Entering as demo…",

    "app.greeting": "Hi,",
    "app.h1": "Your roadmap workspace",
    "app.lead": "You'll be able to create and manage your roadmaps here soon.",
    "app.new": "New roadmap",
    "app.stats.roadmaps": "Roadmaps",
    "app.stats.roadmaps.hint": "Create your first roadmap",
    "app.stats.teams": "Teams",
    "app.stats.teams.hint": "Define who executes",
    "app.stats.capacity": "Available capacity",
    "app.stats.capacity.hint": "Set FTEs per team",
    "app.empty.h2": "No roadmaps yet",
    "app.empty.lead":
      "In the next iteration you'll be able to create initiatives, assign them to teams and validate against real capacity.",
    "app.meta.title": "My workspace — RoadGate",

    "404.h1": "404",
    "404.h2": "Page not found",
    "404.lead": "The page you're looking for doesn't exist or has been moved.",
    "404.home": "Go home",

    "error.h1": "This page didn't load",
    "error.lead": "Something went wrong on our end. You can try refreshing or head back home.",
    "error.retry": "Try again",
    "error.home": "Go home",
  },
} as const;

export type TKey = keyof typeof dict["es"];

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function detectInitial(): Locale {
  if (typeof window === "undefined") return "es";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === "es" || stored === "en") return stored;
  const nav = window.navigator?.language?.toLowerCase() ?? "";
  return nav.startsWith("en") ? "en" : "es";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    setLocaleState(detectInitial());
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
  }, []);

  const t = useCallback((key: TKey) => dict[locale][key] ?? dict.es[key] ?? key, [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
