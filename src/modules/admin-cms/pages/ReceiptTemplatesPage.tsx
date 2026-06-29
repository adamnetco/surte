import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { ReceiptTemplateForm } from "../components/receipts/ReceiptTemplateForm";
import { ReceiptPreview } from "../components/receipts/ReceiptPreview";
import { ReceiptGallerySheet } from "../components/receipts/ReceiptGallerySheet";
import {
  useResolveReceiptTemplate,
  useUpdateReceiptTemplate,
  type ReceiptTemplate,
} from "../hooks/usePosReceiptTemplates";
import {
  RECEIPT_CHANNELS,
  CHANNEL_LABEL,
  layoutSchema,
  type ReceiptChannel,
} from "../lib/receiptLayoutSchema";
import { buildMockOrder } from "../lib/receiptMockData";
import type { ReceiptPreset } from "../lib/receiptTemplateGallery";

export default function ReceiptTemplatesPage() {
  const [channel, setChannel] = useState<ReceiptChannel>("counter");
  const { currentOrg } = useOrganization();
  const { data: serverTpl, isLoading } = useResolveReceiptTemplate(channel);
  const update = useUpdateReceiptTemplate();
  const [localTpl, setLocalTpl] = useState<ReceiptTemplate | null>(null);
  const [printing, setPrinting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const template = localTpl && localTpl.id === serverTpl?.id ? localTpl : serverTpl ?? null;
  const order = useMemo(() => buildMockOrder(channel), [channel]);

  const handleExport = () => {
    if (!template) return;
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      channel: template.channel,
      paper_width_mm: template.paper_width_mm,
      font_size_pt: template.font_size_pt,
      copies: template.copies,
      show_logo: template.show_logo,
      show_qr_pago: template.show_qr_pago,
      show_nit: template.show_nit,
      header_text: template.header_text,
      footer_text: template.footer_text,
      layout: template.layout,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recibo-${template.channel}-${template.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Plantilla exportada");
  };

  const handleImportFile = async (file: File) => {
    if (!template) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const layoutParsed = layoutSchema.parse(parsed.layout);
      await update.mutateAsync({
        id: template.id,
        paper_width_mm: parsed.paper_width_mm ?? template.paper_width_mm,
        font_size_pt: parsed.font_size_pt ?? template.font_size_pt,
        copies: parsed.copies ?? template.copies,
        show_logo: parsed.show_logo ?? template.show_logo,
        show_qr_pago: parsed.show_qr_pago ?? template.show_qr_pago,
        show_nit: parsed.show_nit ?? template.show_nit,
        header_text: parsed.header_text ?? template.header_text,
        footer_text: parsed.footer_text ?? template.footer_text,
        layout: { sections: layoutParsed.sections },
      });
      toast.success("Plantilla importada");
    } catch (e: any) {
      toast.error(`JSON inválido: ${e?.message ?? e}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleApplyPreset = async (preset: ReceiptPreset) => {
    if (!template) return;
    try {
      await update.mutateAsync({
        id: template.id,
        paper_width_mm: preset.paper_width_mm,
        font_size_pt: preset.font_size_pt,
        show_logo: preset.show_logo,
        show_qr_pago: preset.show_qr_pago,
        show_nit: preset.show_nit,
        header_text: preset.header_text ?? template.header_text,
        footer_text: preset.footer_text ?? template.footer_text,
        layout: { sections: preset.layout.sections },
      });
      toast.success(`Preset "${preset.name}" aplicado`);
    } catch (e: any) {
      toast.error(`No se pudo aplicar: ${e?.message ?? e}`);
    }
  };

  useEffect(() => {
    document.title = "Plantillas de recibo · SistecPOS";
  }, []);

  // Slice 4 — Encola un print_job de prueba con datos mock para validar layout end-to-end.
  const handleTestPrint = async () => {
    if (!currentOrg?.id || !template) return;
    setPrinting(true);
    try {
      // Buscar primera impresora activa de la org (preferentemente de cocina si channel=kitchen).
      const { data: printers } = await supabase
        .from("printers" as any)
        .select("id, name, is_default, station_id")
        .eq("organization_id", currentOrg.id)
        .eq("active", true)
        .order("is_default", { ascending: false })
        .limit(1);
      const printerId = (printers?.[0] as any)?.id ?? null;
      if (!printerId) {
        toast.error("No hay impresoras activas. Configura una en Configuración → Impresoras.");
        return;
      }
      const kind =
        channel === "kitchen" ? "kitchen" : channel === "void" ? "void" : "receipt";
      const { error } = await supabase.from("print_jobs" as any).insert({
        organization_id: currentOrg.id,
        printer_id: printerId,
        kind,
        channel,
        copies: 1,
        status: "queued",
        payload: { mock: true, mock_order: order, station_name: order.station ?? null },
      });
      if (error) throw error;
      toast.success(`Prueba encolada (${CHANNEL_LABEL[channel]}) en impresora seleccionada.`);
    } catch (e: any) {
      toast.error(`No se pudo encolar: ${e?.message ?? e}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plantillas de recibo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Diseña los recibos térmicos 58/80mm por canal de venta. Los cambios se guardan automáticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptGallerySheet onApply={handleApplyPreset} />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!template}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!template}>
            <Upload className="h-4 w-4 mr-2" /> Importar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestPrint}
            disabled={printing || !template}
            title="Encola un trabajo de impresión con datos mock"
          >
            {printing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
            Imprimir prueba
          </Button>
        </div>
      </header>

      <Tabs value={channel} onValueChange={(v) => setChannel(v as ReceiptChannel)} className="mb-6">
        <TabsList className="flex flex-wrap h-auto">
          {RECEIPT_CHANNELS.map((c) => (
            <TabsTrigger key={c} value={c}>{CHANNEL_LABEL[c]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading || !template ? (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
          <ReceiptTemplateForm template={template} onLocalChange={setLocalTpl} />
          <Card className="p-6 bg-muted/30 border-dashed sticky top-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3 text-center">
              Vista previa · {template.paper_width_mm}mm · {CHANNEL_LABEL[channel]}
            </div>
            <ReceiptPreview template={template} order={order} />
          </Card>
        </div>
      )}
    </div>
  );
}
