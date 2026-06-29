// Slice 5 — Galería de presets aplicables a la plantilla actual.
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { RECEIPT_PRESETS, type ReceiptPreset } from "../../lib/receiptTemplateGallery";

interface Props {
  onApply: (preset: ReceiptPreset) => void;
}

export function ReceiptGallerySheet({ onApply }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Galería
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Presets de plantilla</SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Al aplicar, se reemplaza el layout y la configuración visual de la plantilla actual.
          El nombre y canal se conservan.
        </p>
        <div className="space-y-3">
          {RECEIPT_PRESETS.map((p) => (
            <Card key={p.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.description}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {p.paper_width_mm}mm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {p.layout.sections.length} secciones · {p.font_size_pt}pt
                </span>
                <Button size="sm" variant="secondary" onClick={() => onApply(p)}>
                  Aplicar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
