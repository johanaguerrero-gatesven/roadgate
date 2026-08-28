import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { ItemType, importCSV } from "@/lib/roadmap";
import { exportItemsXlsx } from "@/lib/export-xlsx";
import { WorkItemIcon } from "@/lib/work-item-icons";

import { ALL_TYPES, TYPE_LABEL, loadEnabledTypes, saveEnabledTypes } from "@/features/roadmap/constants";
import { useRoadmapBoard } from "@/features/roadmap/hooks/use-roadmap-board";
import { DashboardPanel } from "@/features/roadmap/components/DashboardPanel";
import { BacklogSettingsBar } from "@/features/roadmap/components/BacklogSettingsBar";
import { BacklogPanel } from "@/features/roadmap/components/BacklogPanel";
import { RoadmapView } from "@/features/roadmap/components/RoadmapView";
import { CapacityPanel } from "@/features/roadmap/components/CapacityPanel";
import { PublishRoadmapToHarvestr } from "@/components/PublishRoadmapToHarvestr";
import { ShareRoadmapDialog } from "@/features/roadmap/components/ShareRoadmapDialog";


export const Route = createFileRoute("/roadmaps/$roadmapId")({
  head: () => ({ meta: [{ title: "Roadmap — RoadGate" }] }),
  component: RoadmapPage,
});

function RoadmapPage() {
  const { session, ready } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { roadmapId } = Route.useParams();

  const {
    items, cfg, roadmapName, canEdit, isAdmin,
    update, updateOne, updateCapacity, moveQuarter, remove, add, addDetailed, removeAllOfType,
  } = useRoadmapBoard(roadmapId, session?.userId);

  const [tab, setTab] = useState<ItemType>("epic");
  const [enabledTypes, setEnabledTypesState] = useState<ItemType[]>(ALL_TYPES);
  const [wrapText, setWrapText] = useState(false);

  useEffect(() => { setEnabledTypesState(loadEnabledTypes()); }, []);
  useEffect(() => {
    if (!enabledTypes.includes(tab) && enabledTypes.length) setTab(enabledTypes[0]);
  }, [enabledTypes, tab]);
  const setEnabledTypes = (types: ItemType[]) => {
    const next = types.length ? types : ALL_TYPES;
    setEnabledTypesState(next);
    saveEnabledTypes(next);
  };

  useEffect(() => {
    if (ready && !session) navigate({ to: "/login" });
  }, [ready, session, navigate]);

  if (!ready || !session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1700px] px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/roadmaps"><ArrowLeft className="h-4 w-4" /> Mis roadmaps</Link>
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1700px] px-6 py-8">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("roadmap.title")}</div>
            <h1 className="text-3xl font-bold text-foreground">{roadmapName || "…"}</h1>
            <p className="text-muted-foreground mt-1">{t("roadmap.lead")}</p>
            {!canEdit && (
              <p className="mt-2 inline-block rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                {t("share.readOnly")}
              </p>
            )}
          </div>
          {isAdmin && <ShareRoadmapDialog roadmapId={roadmapId} />}
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">{t("roadmap.tab.dashboard")}</TabsTrigger>
            <TabsTrigger value="backlog">{t("roadmap.tab.backlog")}</TabsTrigger>
            <TabsTrigger value="roadmap">{t("roadmap.tab.roadmap")}</TabsTrigger>
            <TabsTrigger value="capacity">{t("roadmap.tab.capacity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardPanel items={items} cfg={cfg} />
          </TabsContent>

          <TabsContent value="backlog" className="mt-6">
            <BacklogSettingsBar
              wrapText={wrapText}
              onWrapTextChange={setWrapText}
              enabledTypes={enabledTypes}
              onEnabledTypesChange={setEnabledTypes}
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as ItemType)}>
              <TabsList>
                {enabledTypes.map((ty) => (
                  <TabsTrigger key={ty} value={ty} className="gap-1.5">
                    <WorkItemIcon type={ty} className="h-4 w-4" />
                    {TYPE_LABEL[ty]} ({items.filter((i) => i.type === ty).length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {enabledTypes.map((ty) => (
                <TabsContent key={ty} value={ty} className="mt-4">
                  <BacklogPanel
                    type={ty}
                    items={items}
                    wrapText={wrapText}
                    onAdd={() => add(ty)}
                    onCreate={(draft) => addDetailed(ty, draft)}
                    onUpdate={updateOne}
                    onMoveQuarter={moveQuarter}
                    onRemove={remove}
                    onImport={(csv) => update(importCSV(csv, ty, items))}
                    onExportXlsx={() => {
                      try {
                        exportItemsXlsx(items, ty);
                        toast.success(`Excel de ${TYPE_LABEL[ty]} generado`);
                      } catch (e) {
                        console.error(e);
                        toast.error("Error al exportar Excel");
                      }
                    }}
                    onResetType={() => {
                      const count = items.filter((i) => i.type === ty).length;
                      if (!count) { toast.info(`No hay ${TYPE_LABEL[ty]} que borrar`); return; }
                      if (!window.confirm(`¿Borrar los ${count} ${TYPE_LABEL[ty]} de este roadmap? Esta acción no se puede deshacer.`)) return;
                      removeAllOfType(ty);
                      toast.success(`${TYPE_LABEL[ty]} borrados`);
                    }}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="roadmap" className="mt-6">
            <PublishRoadmapToHarvestr items={items} roadmapName={roadmapName} />
            <RoadmapView items={items} cfg={cfg} onMove={moveQuarter} onRestore={update} onUpdate={updateOne} />
          </TabsContent>


          <TabsContent value="capacity" className="mt-6">
            <CapacityPanel cfg={cfg} roadmapId={roadmapId} onChange={updateCapacity} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
