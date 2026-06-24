import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Settings2, Mail, MessageCircle, HelpCircle, ShieldAlert } from "lucide-react";
import { useOrgDocumentTypes } from "@/modules/pos/hooks/useOrgDocumentTypes";

interface PosBehavior {
  default_doc_type: string;
  ask_on_each_sale: boolean;
  auto_send_email: boolean;
  auto_send_whatsapp: boolean;
}

const DEFAULTS: PosBehavior = {
  default_doc_type: "pos_electronico",
  ask_on_each_sale: false,
  auto_send_email: true,
  auto_send_whatsapp: false,
};

interface Props { organizationId: string; }

/**
 * AC13: Comportamiento POS — define qué documento DIAN se asume por defecto al cobrar,
 * si pedimos confirmación al cajero en cada venta y qué se envía automáticamente.
 */
export default function POSBehaviorSettings({ organizationId }: Props) {
  const [behavior, setBehavior] = useState<PosBehavior>(DEFAULTS);
  const [hardBlock, setHardBlock] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const { data: docTypes = [], isLoading: docsLoading } = useOrgDocumentTypes(organizationId, "pos");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("einvoice_configs")
        .select("id, pos_behavior, hard_block_when_dian_down")
        .eq("organization_id", organizationId)
        .eq("environment", "prod")
        .maybeSingle();
      if (data) {
        setConfigId(data.id);
        setBehavior({ ...DEFAULTS, ...((data.pos_behavior as any) ?? {}) });
        setHardBlock(!!(data as any).hard_block_when_dian_down);
      }
      setLoading(false);
    })();
  }, [organizationId]);

  const save = async () => {
    setSaving(true);
    const payload: any = {
      organization_id: organizationId,
      environment: "prod",
      pos_behavior: behavior as any,
      hard_block_when_dian_down: hardBlock,
    };
    if (configId) payload.id = configId;
    const { error } = await supabase
      .from("einvoice_configs")
      .upsert(payload, { onConflict: "organization_id,environment" });
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Comportamiento POS guardado" });
  };

  if (loading) {
    return (
      <Card className="p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">Comportamiento POS</h2>
          <p className="text-xs text-muted-foreground">
            Define qué documento DIAN emite el POS al cobrar y cómo se entrega al cliente.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Documento por defecto al cobrar</Label>
        <Select
          value={behavior.default_doc_type}
          onValueChange={(v) => setBehavior({ ...behavior, default_doc_type: v })}
          disabled={docsLoading}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Selecciona un documento" />
          </SelectTrigger>
          <SelectContent>
            {docTypes.length === 0 && (
              <SelectItem value="pos_electronico" disabled>
                Sin tipos configurados (revisa "Tipos de documento")
              </SelectItem>
            )}
            {docTypes.map((dt) => (
              <SelectItem key={dt.id} value={dt.code}>
                {dt.label}
                {dt.dian_code && <span className="text-muted-foreground ml-2">· DIAN {dt.dian_code}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Es el documento que el POS asume cuando el cajero presiona <b>COBRAR</b> sin elegir uno manualmente.
        </p>
      </div>

      <BehaviorRow
        icon={HelpCircle}
        title="Preguntar tipo de documento en cada venta"
        description="Si está activado, el POS muestra el selector antes de finalizar cada cobro."
        checked={behavior.ask_on_each_sale}
        onChange={(v) => setBehavior({ ...behavior, ask_on_each_sale: v })}
      />

      <BehaviorRow
        icon={Mail}
        title="Enviar email automáticamente al cliente"
        description="Cuando la factura es aceptada por la DIAN, se envía el PDF y XML al correo del cliente."
        checked={behavior.auto_send_email}
        onChange={(v) => setBehavior({ ...behavior, auto_send_email: v })}
      />

      <BehaviorRow
        icon={MessageCircle}
        title="Enviar enlace por WhatsApp"
        description="Al aceptarse la factura, se envía un mensaje con el enlace de descarga al WhatsApp del cliente."
        checked={behavior.auto_send_whatsapp}
        onChange={(v) => setBehavior({ ...behavior, auto_send_whatsapp: v })}
      />

      <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">Bloquear cobro si DIAN está offline</p>
              <Badge variant="secondary" className="text-[10px]">Recomendado para HORECA alto volumen</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cuando la DIAN/Innapsis está caída y no hay rango de contingencia vigente, el botón <b>Cobrar</b> se deshabilita.
              Evita ventas que después no se podrán normalizar dentro de las 48h. Superadmin puede forzar override por sesión.
            </p>
          </div>
        </div>
        <Switch checked={hardBlock} onCheckedChange={setHardBlock} />
      </div>



      <div className="flex justify-end pt-2 border-t">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </Card>
  );
}

function BehaviorRow({
  icon: Icon, title, description, checked, onChange,
}: {
  icon: typeof Settings2;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
