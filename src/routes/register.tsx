import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthProviders } from "@/components/AuthProviders";
import { register, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { AuthShell } from "./login";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crear cuenta — RoadGate" },
      { name: "description", content: "Crea tu cuenta de RoadGate y empieza a planificar tu roadmap." },
    ],
  }),
  component: RegisterPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) navigate({ to: "/app" });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await register(parsed.data.name, parsed.data.email, parsed.data.password);
      toast.success("¡Cuenta creada! Bienvenido a RoadGate 🚀");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Crea tu cuenta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Empieza gratis. Sin tarjeta de crédito.
        </p>
      </div>

      <AuthProviders providers={["google"]} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-background px-2 text-muted-foreground">o regístrate con email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" autoComplete="name" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Al continuar aceptas nuestros términos y política de privacidad.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
