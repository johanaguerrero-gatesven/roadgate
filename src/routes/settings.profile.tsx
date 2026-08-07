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
          <SecuritySection />
        </TabsContent>

        <TabsContent value="notifications" className="py-6">
          <p className="text-sm text-muted-foreground">{t("integrations.soon")}</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------ Security Section ------------------------------ */

function SecuritySection() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex gap-3 rounded-lg border border-border p-4">
        <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
          <ShieldOff className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">Two-factor authentication</h3>
          <p className="text-sm text-muted-foreground">
            Two-factor authentication is not available yet. It will be provided as a
            server-verified second factor (TOTP / phone) so that codes and secrets are
            never stored or validated in your browser.
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Your account is protected by your password and, when used, your identity provider
        (Google). Sessions are issued and validated on the server.
      </p>
    </div>
  );
}
