import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { getCompany, saveCompany, type Company } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/company")({
  component: CompanyPage,
});

const FY_OPTIONS = [
  "January 31st", "February 28th", "March 31st", "April 30th", "May 31st", "June 30th",
  "July 31st", "August 31st", "September 30th", "October 31st", "November 30th", "December 31st",
];

function CompanyPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Company>(() => getCompany());
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setData((d) => ({ ...d, logoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const onSave = () => {
    saveCompany(data);
    toast.success(t("settings.saved"));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("company.h1")}</h2>
          <Button onClick={onSave}>{t("settings.save")}</Button>
        </div>
        <div className="p-6 grid md:grid-cols-[160px_1fr] gap-y-6 gap-x-6 items-start">
          <Label className="pt-2 text-muted-foreground">{t("company.name")}</Label>
          <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />

          <Label className="pt-2 text-muted-foreground">{t("company.fiscalYearEnd")}</Label>
          <Select value={data.fiscalYearEnd} onValueChange={(v) => setData({ ...data, fiscalYearEnd: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FY_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <Label className="pt-2 text-muted-foreground">{t("company.billingEmail")}</Label>
          <Input type="email" value={data.billingEmail} onChange={(e) => setData({ ...data, billingEmail: e.target.value })} />

          <Label className="pt-2 text-muted-foreground">{t("company.logo")}</Label>
          <div className="flex items-center gap-4">
            <div className="h-24 w-32 rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden">
              {data.logoDataUrl ? (
                <img src={data.logoDataUrl} alt="logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button onClick={() => fileRef.current?.click()}>{t("profile.uploadImage")}</Button>
                {data.logoDataUrl && (
                  <Button variant="outline" onClick={() => setData({ ...data, logoDataUrl: undefined })}>
                    {t("company.removeImage")}
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">{t("profile.uploadHint")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{t("company.authSettings")}</h2>
        </div>
        <div className="p-6 grid md:grid-cols-[200px_1fr] gap-y-6 gap-x-6 items-center">
          <Label className="text-muted-foreground">{t("company.minPasswordLength")}</Label>
          <Input
            type="number"
            min={6}
            max={64}
            value={data.minPasswordLength}
            onChange={(e) => setData({ ...data, minPasswordLength: Number(e.target.value) })}
            className="max-w-xs"
          />

          <div />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={data.enterprisePasswordStrength}
              onCheckedChange={(v) => setData({ ...data, enterprisePasswordStrength: !!v })}
            />
            {t("company.enterprisePasswordStrength")}
          </label>

          <Label className="text-muted-foreground">{t("company.defaultAuthMethod")}</Label>
          <Select
            value={data.defaultAuthMethod}
            onValueChange={(v) => setData({ ...data, defaultAuthMethod: v as Company["defaultAuthMethod"] })}
          >
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="password">password</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="sso">SSO</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
