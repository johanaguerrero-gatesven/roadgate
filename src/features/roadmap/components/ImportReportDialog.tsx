/**
 * Informe de validación previo a importar un CSV/Excel.
 * Muestra errores bloqueantes y avisos; solo permite continuar si no hay errores.
 */
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ImportReport, EXPECTED_COLUMNS } from "@/lib/csv-validation";
import { ItemType } from "@/lib/roadmap";

export function ImportReportDialog({
  report, type, fileName, onCancel, onConfirm,
}: {
  report: ImportReport | null;
  type: ItemType;
  fileName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!report) return null;
  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {report.ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-destructive" />}
            Validación de la importación
          </DialogTitle>
          <DialogDescription>
            {fileName ? `${fileName} — ` : ""}
            {report.totalRows} filas leídas, {report.validRows} válidas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant={report.errorCount ? "destructive" : "secondary"}>{report.errorCount} errores</Badge>
          <Badge variant="outline">{report.warningCount} avisos</Badge>
        </div>

        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Estructura esperada</p>
          <p className="mt-1 break-words">{EXPECTED_COLUMNS[type].join(" · ")}</p>
          {!!report.headers.length && (
            <>
              <p className="mt-2 font-medium text-foreground">Estructura del fichero</p>
              <p className="mt-1 break-words">{report.headers.join(" · ")}</p>
            </>
          )}
        </div>

        <ScrollArea className="max-h-72 rounded-md border border-border">
          <ul className="divide-y divide-border text-sm">
            {[...errors, ...warnings].map((i, k) => (
              <li key={k} className="flex gap-2 p-2.5">
                {i.severity === "error"
                  ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                <span>
                  {(i.row || i.column) && (
                    <span className="mr-1 font-mono text-xs text-muted-foreground">
                      {i.row ? `fila ${i.row}` : ""}{i.row && i.column ? " · " : ""}{i.column ?? ""}
                    </span>
                  )}
                  {i.message}
                </span>
              </li>
            ))}
            {!report.issues.length && (
              <li className="p-3 text-muted-foreground">Sin incidencias: el fichero cumple la estructura esperada.</li>
            )}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!report.ok} onClick={onConfirm}>
            {report.ok ? "Importar" : "Corrige los errores para importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
