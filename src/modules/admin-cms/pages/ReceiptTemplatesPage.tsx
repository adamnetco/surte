import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ReceiptTemplateForm } from "../components/receipts/ReceiptTemplateForm";
import { ReceiptPreview } from "../components/receipts/ReceiptPreview";
import {
  useResolveReceiptTemplate,
  type ReceiptTemplate,
} from "../hooks/usePosReceiptTemplates";
import {
  RECEIPT_CHANNELS,
  CHANNEL_LABEL,
  type ReceiptChannel,
} from "../lib/receiptLayoutSchema";
import { buildMockOrder } from "../lib/receiptMockData";

export default function ReceiptTemplatesPage() {
  const [channel, setChannel] = useState<ReceiptChannel>("counter");
  const { data: serverTpl, isLoading } = useResolveReceiptTemplate(channel);
  const [localTpl, setLocalTpl] = useState<ReceiptTemplate | null>(null);

  const template = localTpl && localTpl.id === serverTpl?.id ? localTpl : serverTpl ?? null;
  const order = useMemo(() => buildMockOrder(channel), [channel]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <Helmet>
        <title>Plantillas de recibo · SistecPOS</title>
        <meta name="description" content="Diseñador visual de recibos POS 80mm con preview en vivo, por canal de venta." />
      </Helmet>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Plantillas de recibo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Diseña los recibos térmicos 58/80mm por canal de venta. Los cambios se guardan automáticamente.
        </p>
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
              Vista previa · {template.paper_width_mm}mm
            </div>
            <ReceiptPreview template={template} order={order} />
          </Card>
        </div>
      )}
    </div>
  );
}
