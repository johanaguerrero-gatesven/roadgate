import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthProviders } from "@/components/AuthProviders";
import { AuthShell } from "./login";
import { login, register, getSession, clearSession } from "@/lib/auth";
import {
  getTwoFA,
  generateCode,
  setPendingLogin,
  getPendingLogin,
  clearPendingLogin,
} from "@/lib/twofa";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Smartphone, KeyRound, RefreshCw, Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login_2")({
  head: () => ({
    meta: [
      { title: "Sign in — RoadGate" },
      { name: "description", content: "Access your RoadGate account." },
    ],
  }),
  component: Login2Page,
});

type Step = "auth" | "challenge";

function Login2Page() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("auth");

  useEffect(() => {
    if (getSession()) navigate({ to: "/app" });
    if (getPendingLogin()) setStep("challenge");
  }, [navigate]);

  return (
    <AuthShell>
      {step === "auth" ? (
        <AuthTabs onChallenge={() => setStep("challenge")} />
      ) : (
        <ChallengeView onBack={() => { clearPendingLogin(); setStep("auth"); }} />
      )}
    </AuthShell>
  );
}

/* ----------------------------- Auth (login + register) ----------------------------- */

function AuthTabs({ onChallenge }: { onChallenge: () => void }) {
  return (
    <Tabs defaultValue="signin" className="w-full">
      <div className="text-center mb-6 space-y-1">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">Welcome to RoadGate</h1>
        <p className="text-sm text-muted-foreground">Sign in or create a new account</p>
      </div>

      <TabsList className="grid grid-cols-2 w-full mb-6">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Sign up</TabsTrigger>
      </TabsList>

      <TabsContent value="signin" className="space-y-5">
        <AuthProviders />
        <Divider>or with email</Divider>
        <SignInForm onChallenge={onChallenge} />
      </TabsContent>

      <TabsContent value="signup" className="space-y-5">
        <AuthProviders providers={["google"]} />
        <Divider>or sign up with email</Divider>
        <SignUpForm />
      </TabsContent>
    </Tabs>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-card px-2 text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}

function SignInForm({ onChallenge }: { onChallenge: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    email: z.string().trim().email("Invalid email").max(255),
    password: z.string().min(6, "At least 6 characters").max(100),
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await login(parsed.data.email, parsed.data.password);

      // Check 2FA
      const twofa = getTwoFA(parsed.data.email);
      if (twofa.method !== "off") {
        // Drop the session until the second factor is verified.
        clearSession();
        const code = generateCode();
        setPendingLogin({ email: parsed.data.email, method: twofa.method, code });
        toast.info(
          twofa.method === "sms"
            ? `SMS code sent to ${twofa.phone ?? "your phone"} (demo: ${code})`
            : `Open your authenticator app (demo code: ${code})`,
        );
        onChallenge();
      } else {
        toast.success("Welcome back 👋");
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="si-pwd">Password</Label>
        <Input id="si-pwd" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
      </div>
      <Button type="submit" className="w-full h-11" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Need the classic page?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">Go to /login</Link>
      </p>
    </form>
  );
}

function SignUpForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaChallenge, setCaptchaChallenge] = useState(() => makeCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [notRobot, setNotRobot] = useState(false);
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(2, "Name too short").max(80),
    email: z.string().trim().email("Invalid email").max(255),
    password: z.string().min(6, "At least 6 characters").max(100),
  });

  const verifyCaptcha = () => {
    if (captchaInput.trim().toUpperCase() === captchaChallenge.answer && notRobot) {
      setCaptchaOk(true);
      toast.success("Captcha verified");
    } else {
      setCaptchaOk(false);
      toast.error("Captcha incorrect — try again");
      refreshCaptcha();
    }
  };

  const refreshCaptcha = () => {
    setCaptchaChallenge(makeCaptcha());
    setCaptchaInput("");
    setCaptchaOk(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaOk) {
      toast.error("Please complete the captcha first");
      return;
    }
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await register(parsed.data.name, parsed.data.email, parsed.data.password);
      toast.success("Account created 🚀");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-up error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Name</Label>
        <Input id="su-name" autoComplete="name" value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pwd">Password</Label>
        <Input id="su-pwd" type="password" autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required />
      </div>

      {/* Captcha block */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Security check
          </span>
          {captchaOk && (
            <span className="text-xs text-primary inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified
            </span>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={notRobot} onCheckedChange={(v) => setNotRobot(!!v)} />
          <span className="text-sm">I'm not a robot</span>
        </label>

        <div className="flex items-center gap-2">
          <div
            aria-label="Captcha code"
            className="select-none font-mono text-lg tracking-[0.4em] px-3 py-2 rounded-md bg-background border border-border flex-1 text-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 6px, hsl(var(--muted-foreground)/0.08) 6px 7px)",
              textDecoration: "line-through",
              textDecorationStyle: "wavy",
              textDecorationColor: "hsl(var(--muted-foreground)/0.4)",
            }}
          >
            {captchaChallenge.answer}
          </div>
          <Button type="button" variant="outline" size="icon" onClick={refreshCaptcha} aria-label="Refresh captcha">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            placeholder="Type the code above"
            className="font-mono"
          />
          <Button type="button" variant="secondary" onClick={verifyCaptcha}>
            Verify
          </Button>
        </div>
      </div>

      <Button type="submit" className="w-full h-11" disabled={loading || !captchaOk}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        By continuing you accept our terms and privacy policy.
      </p>
    </form>
  );
}

function makeCaptcha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return { answer: s };
}

/* ----------------------------- 2FA Challenge step ----------------------------- */

function ChallengeView({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const pending = useMemo(() => getPendingLogin(), []);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  if (!pending) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">No pending verification.</p>
        <Button onClick={onBack}>Back to sign in</Button>
      </div>
    );
  }

  const isSms = pending.method === "sms";

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (code.trim() !== pending.code) {
        toast.error("Invalid code");
        return;
      }
      // Re-establish session by logging in again is not possible without password;
      // simulate by writing the session directly.
      const ev = new Event("roadgate:auth");
      localStorage.setItem(
        "roadgate.session",
        JSON.stringify({ userId: pending.email, email: pending.email, name: pending.email.split("@")[0] }),
      );
      window.dispatchEvent(ev);
      clearPendingLogin();
      toast.success("2FA verified — welcome back 👋");
      navigate({ to: "/app" });
    } finally {
      setLoading(false);
    }
  };

  const resend = () => {
    const newCode = generateCode();
    setPendingLogin({ ...pending, code: newCode });
    toast.info(
      isSms ? `New SMS code (demo: ${newCode})` : `New authenticator code (demo: ${newCode})`,
    );
  };

  return (
    <form onSubmit={verify} className="space-y-5">
      <div className="text-center space-y-1">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
          {isSms ? <Smartphone className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
        </div>
        <h1 className="text-2xl font-bold">Two-factor verification</h1>
        <p className="text-sm text-muted-foreground">
          {isSms
            ? "Enter the 6-digit code we sent via SMS."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="otp">Verification code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="text-center text-2xl tracking-[0.5em] font-mono h-14"
          required
        />
      </div>

      <Button type="submit" className="w-full h-11" disabled={loading || code.length !== 6}>
        {loading ? "Verifying…" : "Verify and continue"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <Lock className="h-3.5 w-3.5" /> Use another account
        </button>
        <button type="button" onClick={resend} className="text-primary hover:underline">
          Resend code
        </button>
      </div>
    </form>
  );
}
