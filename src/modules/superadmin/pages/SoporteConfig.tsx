import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Save, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const KEY_NUMBER = "support_whatsapp_number";
const KEY_MESSAGE = "support_whatsapp_message";

export default function SoporteConfig() {
  const qc = useQueryClient();
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["support-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", [KEY_NUMBER, KEY_MESSAGE])
        .is("organization_id", null);
      if (error) throw error;
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value as string]));
      return {
        number: (map[KEY_NUMBER] as string) ?? "",
        message: (map[KEY_MESSAGE] as string) ?? "",
      };
    },
  });

  useEffect(() => {
    if (data) {
      setNumber(data.number);
      setMessage(data.message);
    }
  }, [data]);

  const cleanNumber = number.replace(/\D/g, "");
  const valid = cleanNumber.length >= 10 && cleanNumber.length <= 15;
  const waPreview = valid
    ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message || "")}`
    : null;

  const save = async () => {
    if (!valid) {
      toast.error("Número inválido. Usa formato internacional sin '+' (ej: 573001234567).");
      return;
    }
    setSaving(true);
    try {
      const rows = [
        { key: KEY_NUMBER, value: cleanNumber, organization_id: null },
        { key: KEY_MESSAGE, value: message.trim(), organization_id: null },
      ];
      const { error } = await supabase
        .from("app_settings")
        .upsert(rows, { onConflict: "key,organization_id" } as any);
      if (error) throw error;
      toast.success("WhatsApp de soporte actualizado.");
      qc.invalidateQueries({ queryKey: ["support-config"] });
      qc.invalidateQueries({ queryKey: ["support-contact"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" /> WhatsApp de soporte
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Número global de contacto al que se enviará a los clientes desde toasts, banners
          de tienda suspendida y el botón flotante de ayuda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
          <CardDescription>Aplica a todas las tiendas del SaaS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-20 animate-pulse bg-muted rounded" />
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="wa-number">Número (formato internacional, sin "+")</Label>
                <Input
                  id="wa-number"
                  inputMode="numeric"
                  placeholder="573001234567"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Solo dígitos. Incluye el código de país (Colombia = 57).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wa-msg">Mensaje por defecto</Label>
                <Textarea
                  id="wa-msg"
                  rows={3}
                  placeholder="Hola, necesito ayuda con mi tienda en SistecPOS."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {waPreview && (
                <a
                  href={waPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Probar enlace <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <div className="pt-2">
                <Button onClick={save} disabled={saving || !valid}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
