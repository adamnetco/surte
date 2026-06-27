import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Eye, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const SEGMENT_LABELS: Record<string, { label: string; color: string }> = {
  "Champions": { label: "Champions", color: "bg-emerald-500" },
  "Loyal": { label: "Loyal", color: "bg-blue-500" },
  "Potential": { label: "Potential", color: "bg-indigo-500" },
  "New": { label: "New", color: "bg-teal-500" },
  "At Risk": { label: "At Risk", color: "bg-amber-500" },
  "Hibernating": { label: "Hibernating", color: "bg-gray-500" },
};

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export const RfmCampaignSheet = ({ open, onOpenChange }: Props) => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const [segment, setSegment] = useState<string>("champions");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const { data: counts, isLoading } = useQuery({
    queryKey: ["rfm-segment-counts", orgId],
    enabled: !!orgId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_segments")
        .select("segment")
        .eq("organization_id", orgId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.segment] = (map[r.segment] || 0) + 1; });
      return map;
    },
  });

  const segmentList = useMemo(
    () => Object.keys(SEGMENT_LABELS).map((k) => ({ key: k, ...SEGMENT_LABELS[k], count: counts?.[k] || 0 })),
    [counts]
  );

  const handlePreview = async () => {
    if (!orgId || !segment) return;
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-whatsapp-rfm", {
        body: { organization_id: orgId, segment, message: message || "preview", dry_run: true },
      });
      if (error) throw error;
      toast.success(`${data.total} destinatarios en "${SEGMENT_LABELS[segment].label}"`);
    } catch (e: any) {
      toast.error(e.message || "Error al previsualizar");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!orgId || !segment || !message.trim()) {
      toast.error("Selecciona segmento y escribe un mensaje");
      return;
    }
    if (!window.confirm(`¿Enviar este mensaje a todos los clientes "${SEGMENT_LABELS[segment].label}"?`)) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-whatsapp-rfm", {
        body: { organization_id: orgId, segment, message: message.trim() },
      });
      if (error) throw error;
      toast.success(`Enviados: ${data.sent} / ${data.total}${data.failed ? ` · ${data.failed} fallidos` : ""}`);
      setMessage("");
    } catch (e: any) {
      toast.error(e.message || "Error al enviar campaña");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> Campaña WhatsApp por segmento RFM
          </SheetTitle>
          <SheetDescription>
            Envía mensajes dirigidos a un segmento específico. Solo clientes con número válido recibirán el mensaje.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2">
          <Label>Segmento RFM</Label>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {segmentList.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} />
                      {s.label} <span className="text-muted-foreground text-xs">({s.count})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-[11px] text-muted-foreground">
            Tip: corre "Recalcular RFM" en la pestaña Segmentos antes de lanzar campañas.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Mensaje</Label>
            <Badge variant="outline">{message.length}/1000</Badge>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            placeholder="Hola {{nombre}}, tenemos una oferta especial..."
            rows={8}
          />
          <p className="text-[11px] text-muted-foreground">
            Sin emojis. Usa guiones y dos puntos para mejor compatibilidad con WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={handlePreview} disabled={previewing || !segment} className="gap-2">
            <Eye className="h-4 w-4" /> {previewing ? "Calculando..." : "Vista previa"}
          </Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()} className="gap-2 ml-auto">
            <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar campaña"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RfmCampaignSheet;
