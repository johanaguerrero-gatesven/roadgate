import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { useI18n } from "@/lib/i18n";
import { getProfile, saveProfile, type Profile } from "@/lib/profile";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  getTwoFA,
  saveTwoFA,
  disableTwoFA,
  generateCode,
  generateSecret,
  otpAuthUri,
  type TwoFAMethod,
} from "@/lib/twofa";
import { Smartphone, KeyRound, ShieldCheck, ShieldOff, QrCode } from "lucide-react";

export const Route = createFileRoute("/settings/profile")({
  component: ProfilePage,
});

function initialsOf(p: Profile, fallback: string) {
  const a = (p.firstName || fallback).trim().charAt(0);
  const b = (p.lastName || "").trim().charAt(0);
  return (a + b).toUpperCase() || "·";
}

function ProfilePage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const [data, setData] = useState<Profile>(() => getProfile());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = getProfile();
    if (!stored.firstName && session) {
      const [first, ...rest] = (session.name || "").split(" ");
      setData({
        ...stored,
        firstName: first || "",
        lastName: rest.join(" "),
        email: session.email,
      });
    }
  }, [session]);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setData((d) => ({ ...d, avatarDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const onSave = () => {
    saveProfile(data);
    toast.success(t("settings.saved"));
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h2 className="text-xl font-semibold">{t("profile.h1")}</h2>
        <Button onClick={onSave}>{t("settings.save")}</Button>
      </div>

      <Tabs defaultValue="profile" className="px-6 pt-4">
        <TabsList className="bg-transparent p-0 border-b border-border rounded-none w-full justify-start gap-6 h-auto">
          <TabsTrigger
            value="profile"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-xs tracking-wider"
          >
            {t("profile.tab.profile")}
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-xs tracking-wider"
          >
            Security & 2FA
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-xs tracking-wider"
          >
            {t("profile.tab.notifications")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="py-6">
          <div className="grid md:grid-cols-[140px_1fr] gap-y-6 gap-x-6 items-start">
            <Label className="pt-2 text-muted-foreground">{t("profile.avatar")}</Label>
            <div className="flex items-center gap-6">
              <div className="h-28 w-28 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-semibold overflow-hidden">
                {data.avatarDataUrl ? (
                  <img src={data.avatarDataUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  initialsOf(data, session?.name ?? "U")
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("profile.dragHint")}</p>
                <Button variant="default" onClick={() => fileRef.current?.click()}>
                  {t("profile.uploadImage")}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground mt-2">{t("profile.uploadHint")}</p>
              </div>
            </div>

            <Label htmlFor="firstName" className="pt-2 text-muted-foreground">{t("profile.firstName")}</Label>
            <Input id="firstName" value={data.firstName} onChange={(e) => setData({ ...data, firstName: e.target.value })} />

            <Label htmlFor="lastName" className="pt-2 text-muted-foreground">{t("profile.lastName")}</Label>
            <Input id="lastName" value={data.lastName} onChange={(e) => setData({ ...data, lastName: e.target.value })} />

            <Label htmlFor="role" className="pt-2 text-muted-foreground">{t("profile.role")}</Label>
            <Input id="role" value={data.role} onChange={(e) => setData({ ...data, role: e.target.value })} placeholder="Product Manager" />

            <Label htmlFor="phone" className="pt-2 text-muted-foreground">{t("profile.phone")}</Label>
            <Input id="phone" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} placeholder="+34 600 000 000" />

            <div />
            <button className="text-sm text-primary hover:underline w-fit" type="button">
              {t("profile.changeEmail")} ({data.email || session?.email})
            </button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="py-6">
          <p className="text-sm text-muted-foreground">{t("integrations.soon")}</p>
        </TabsContent>
        <TabsContent value="security" className="py-6">
          <TwoFASection email={data.email || session?.email || ""} defaultPhone={data.phone} />
        </TabsContent>

        <TabsContent value="notifications" className="py-6">
          <p className="text-sm text-muted-foreground">{t("integrations.soon")}</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------ 2FA Section ------------------------------ */

function TwoFASection({ email, defaultPhone }: { email: string; defaultPhone?: string }) {
  const [settings, setSettings] = useState(() => getTwoFA(email));

  useEffect(() => {
    setSettings(getTwoFA(email));
  }, [email]);

  if (!email) {
    return <p className="text-sm text-muted-foreground">Save your profile email first to enable 2FA.</p>;
  }

  const enabled = settings.method !== "off";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div className="flex gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold">Two-factor authentication</h3>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? `Active — method: ${settings.method === "sms" ? "SMS" : "Authenticator app"}`
                : "Add an extra layer of security to your account."}
            </p>
          </div>
        </div>
        {enabled && (
          <Button variant="outline" onClick={() => { disableTwoFA(email); setSettings({ method: "off" }); toast.success("2FA disabled"); }}>
            Disable
          </Button>
        )}
      </div>

      <Tabs defaultValue={settings.method === "totp" ? "totp" : "sms"} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="sms" className="gap-2"><Smartphone className="h-4 w-4" /> SMS</TabsTrigger>
          <TabsTrigger value="totp" className="gap-2"><KeyRound className="h-4 w-4" /> Authenticator app</TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="pt-6">
          <SmsSetup
            email={email}
            initialPhone={settings.phone ?? defaultPhone ?? ""}
            active={settings.method === "sms"}
            onActivated={(s) => setSettings(s)}
          />
        </TabsContent>

        <TabsContent value="totp" className="pt-6">
          <TotpSetup
            email={email}
            existingSecret={settings.method === "totp" ? settings.secret : undefined}
            active={settings.method === "totp"}
            onActivated={(s) => setSettings(s)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SmsSetup({ email, initialPhone, active, onActivated }: {
  email: string; initialPhone: string; active: boolean;
  onActivated: (s: { method: TwoFAMethod; phone?: string }) => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const sendCode = () => {
    if (!/^\+?\d[\d\s-]{6,}$/.test(phone.trim())) {
      toast.error("Enter a valid phone number");
      return;
    }
    const c = generateCode();
    setSent(c);
    toast.info(`SMS code sent to ${phone} (demo: ${c})`);
  };

  const verify = () => {
    if (!sent) { toast.error("Send the code first"); return; }
    if (code.trim() !== sent) { toast.error("Invalid code"); return; }
    const next = { method: "sms" as const, phone: phone.trim(), enabledAt: new Date().toISOString() };
    saveTwoFA(email, next);
    onActivated(next);
    setSent(null); setCode("");
    toast.success("SMS 2FA activated");
  };

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="2fa-phone">Phone number</Label>
        <div className="flex gap-2">
          <Input id="2fa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
          <Button type="button" onClick={sendCode} variant="secondary">Send code</Button>
        </div>
        {active && <p className="text-xs text-primary">Current 2FA method.</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="2fa-sms-code">Verification code</Label>
        <div className="flex gap-2">
          <Input
            id="2fa-sms-code"
            inputMode="numeric" maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            className="font-mono tracking-widest"
            disabled={!sent}
          />
          <Button type="button" onClick={verify} disabled={!sent || code.length !== 6}>Verify & activate</Button>
        </div>
      </div>
    </div>
  );
}

function TotpSetup({ email, existingSecret, active, onActivated }: {
  email: string; existingSecret?: string; active: boolean;
  onActivated: (s: { method: TwoFAMethod; secret?: string }) => void;
}) {
  const [secret, setSecret] = useState(() => existingSecret ?? generateSecret());
  const [code, setCode] = useState("");
  const uri = useMemo(() => otpAuthUri(email, secret), [email, secret]);

  const verify = () => {
    if (!/^\d{6}$/.test(code)) { toast.error("Enter the 6-digit code"); return; }
    // Simulated verification: accept any 6 digits.
    const next = { method: "totp" as const, secret, enabledAt: new Date().toISOString() };
    saveTwoFA(email, next);
    onActivated(next);
    setCode("");
    toast.success("Authenticator app 2FA activated");
  };

  return (
    <div className="grid md:grid-cols-[200px_1fr] gap-6 items-start max-w-3xl">
      <div className="flex flex-col items-center gap-2">
        <div className="h-48 w-48 rounded-lg border border-border bg-background p-3 flex items-center justify-center relative overflow-hidden">
          {/* Simulated QR: a tiled pattern derived from the secret */}
          <FakeQR seed={secret} />
          <QrCode className="absolute h-6 w-6 text-muted-foreground/40 right-2 bottom-2" />
        </div>
        <p className="text-xs text-muted-foreground text-center">Scan with Google Authenticator, Authy, 1Password…</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Secret key (backup)</Label>
          <div className="flex gap-2">
            <Input value={secret} readOnly className="font-mono" />
            <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(secret.replace(/\s+/g, "")); toast.success("Secret copied"); }}>Copy</Button>
            <Button type="button" variant="ghost" onClick={() => setSecret(generateSecret())}>Regenerate</Button>
          </div>
          <p className="text-xs text-muted-foreground break-all">{uri}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="totp-code">6-digit code from your app</Label>
          <div className="flex gap-2">
            <Input
              id="totp-code"
              inputMode="numeric" maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="font-mono tracking-widest"
            />
            <Button type="button" onClick={verify} disabled={code.length !== 6}>Activate</Button>
          </div>
          {active && <p className="text-xs text-primary">Current 2FA method.</p>}
        </div>
      </div>
    </div>
  );
}

function FakeQR({ seed }: { seed: string }) {
  // Deterministic 12x12 cells from the seed.
  const cells = useMemo(() => {
    const s = seed.replace(/\s+/g, "");
    const arr: boolean[] = [];
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    for (let i = 0; i < 144; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      arr.push((h & 1) === 1);
    }
    return arr;
  }, [seed]);
  return (
    <div className="grid grid-cols-12 gap-[2px] w-full h-full">
      {cells.map((on, i) => (
        <div key={i} className={on ? "bg-foreground" : "bg-transparent"} />
      ))}
    </div>
  );
}
