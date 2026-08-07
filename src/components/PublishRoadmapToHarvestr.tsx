import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { buildRoadmapView, type RoadmapItem, type Quarter } from "@/lib/roadmap";
import {
  publishRoadmapToHarvestr,
  type PublishRoadmapInput,
  type PublishRoadmapResult,
} from "@/lib/harvestr-publish.functions";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"] as Quarter[];

/**
 * Publica el roadmap tal y como está planificado (un roadmap project por
 * Quarter con contenido) en Harvestr. El token vive sólo en el servidor.
 */
export function PublishRoadmapToHarvestr({
  items,
  roadmapName,
}: {
  items: RoadmapItem[];
  roadmapName: string;
}) {
  const { t } = useI18n();
  const call = useServerFn(publishRoadmapToHarvestr);

  const publish = useMutation<PublishRoadmapResult, Error, PublishRoadmapInput>({
    mutationFn: (input) => call({ data: input }),
    onSuccess: (result) => {
      if (result.created.length === 0) {
        toast.error(t("harvestr.publish.none"));
        return;
      }
      toast.success(`${t("harvestr.publish.ok")} (${result.created.length})`);
      if (result.failed.length > 0) toast.error(t("harvestr.publish.partial"));
    },
    onError: (error) => toast.error(`${t("harvestr.publish.error")} ${error.message}`),
  });

  const view = buildRoadmapView(items);

  const quarters = QUARTERS.map((q) => ({
    quarter: q as "Q1" | "Q2" | "Q3" | "Q4",
    items: view
      .filter((v) => v.quarter === q)
      .map((v) => ({
        code: v.item.id ?? "",
        title: v.item.title ?? "",
        type: v.item.type ?? "",
        effort: typeof v.item.effort === "number" ? v.item.effort : null,
        priority: v.item.priority ?? "",
      })),
  })).filter((g) => g.items.length > 0);

  const total = quarters.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 mb-4">
      <div className="min-w-0">
        <h3 className="font-semibold text-sm">{t("harvestr.publish.h1")}</h3>
        <p className="text-sm text-muted-foreground">
          {total === 0 ? t("harvestr.publish.none") : `${t("harvestr.publish.lead")} · ${total} items`}
        </p>
      </div>
      <Button
        size="sm"
        disabled={publish.isPending || total === 0}
        onClick={() =>
          publish.mutate({
            roadmapName: roadmapName || "Roadmap",
            year: new Date().getFullYear(),
            quarters,
          })
        }
      >
        {publish.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4 mr-2" />
        )}
        {t("harvestr.publish.cta")}
      </Button>
    </div>
  );
}
