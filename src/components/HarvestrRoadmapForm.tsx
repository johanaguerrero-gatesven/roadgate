import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useCreateHarvestrRoadmap } from "@/hooks/use-create-harvestr-roadmap";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

export function HarvestrRoadmapForm() {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const mutation = useCreateHarvestrRoadmap();

  const toIso = (value: string) => (value ? new Date(`${value}T00:00:00Z`).toISOString() : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error(t("harvestr.form.titleRequired"));
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      toast.error(t("harvestr.form.badRange"));
      return;
    }

    mutation.mutate(
      {
        title: trimmed,
        ...(caption.trim() ? { caption: caption.trim() } : {}),
        ...(toIso(startDate) ? { roadmapStartDate: toIso(startDate)! } : {}),
        ...(toIso(endDate) ? { roadmapEndDate: toIso(endDate)! } : {}),
      },
      {
        onSuccess: (result) => {
          toast.success(`${t("harvestr.form.success")} ${result.id ?? "—"}`);
          setTitle("");
          setCaption("");
          setStartDate("");
          setEndDate("");
        },
        onError: (error) => {
          toast.error(`${t("harvestr.form.error")} ${error.message}`);
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] space-y-4"
    >
      <div>
        <h3 className="font-medium">{t("harvestr.form.h1")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t("harvestr.form.lead")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="hv-title">{t("harvestr.form.title")}</Label>
          <Input
            id="hv-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("harvestr.form.titlePlaceholder")}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="hv-caption">{t("harvestr.form.caption")}</Label>
          <Textarea
            id="hv-caption"
            value={caption}
            maxLength={500}
            rows={2}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("harvestr.form.captionPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hv-start">{t("harvestr.form.start")}</Label>
          <Input id="hv-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hv-end">{t("harvestr.form.end")}</Label>
          <Input id="hv-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        {t("harvestr.form.submit")}
      </Button>
    </form>
  );
}
