import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Copy, ShieldOff, ShieldCheck, Plus, Cpu } from "lucide-react";

type License = {
  id: string;
  organization_id: string;
  license_key: string;
  plan: string;
  status: string;
  max_terminals: number;
  expires_at: string | null;
  issued_at: string;
};

type Activation = {
  id: string;
  license_id: string;
  hostname: string | null;
  platform: string | null;
  app_version: string | null;
  machine_fingerprint: string;
  last_heartbeat_at: string;
  revoked_at: string | null;
};

/**
 * Vista de Licencia filtrada SIEMPRE a la tienda activa.
 * Reemplaza el placeholder anterior que redirigía a /licencias (global).
 */
export default function TenantLicenseSection() {
  const { currentOrg } = useOrganization();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);

  async function load() {
    if (!currentOrg) return;
    setLoading(true);
    const { data: lics } = await supabase
      .from("licenses")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    const licList = (lics as any as License[]) ?? [];
    setLicenses(licList);
    if (licList.length > 0) {
      const { data: acts } = await supabase
        .from("license_activations")
        .select("*")
        .in("license_id", licList.map((l) => l.id))
        .order("last_heartbeat_at", { ascending: false });
      setActivations((acts as any as Activation[]) ?? []);
    } else {
      setActivations([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  if (!currentOrg) return null;

  async function setStatus(lic: License, status: string) {
    const { error } = await supabase.from("licenses").update({ status }).eq("id", lic.id);
    if (error) return toast.error(error.message);
    toast.success(`Licencia ${status}`);
    load();
  }

  async function updateMax(lic: License, newMax: number) {
    const { error } = await supabase.from("licenses").update({ max_terminals: newMax }).eq("id", lic.id);
    if (error) return toast.error(error.message);
    toast.success("Terminales actualizados");
    load();
  }

  async function revokeActivation(a: Activation) {
    if (!confirm(`¿Revocar terminal ${a.hostname ?? a.machine_fingerprint.slice(0, 8)}?`)) return;
    const { error } = await supabase
      .from("license_activations")
      .update({ revoked_at: new Date().toISOString(), revoke_reason: "manual" })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Terminal revocada");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Licencias de {currentOrg.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Plan, vigencia y terminales activos para esta tienda.
          </p>
        </div>
        <Button onClick={() => navigate("/licencias")} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Emitir nueva (vista global)
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Cargando…</p>
      ) : licenses.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Esta tienda aún no tiene licencias emitidas.
          <div className="mt-3">
            <Button size="sm" onClick={() => navigate("/licencias")}>
              <Plus className="h-4 w-4 mr-1" /> Emitir licencia
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {licenses.map((lic) => {
            const used = activations.filter((a) => a.license_id === lic.id && !a.revoked_at).length;
            return (
              <Card key={lic.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={lic.status === "active" ? "default" : "destructive"}>{lic.status}</Badge>
                      <Badge variant="outline">{lic.plan}</Badge>
                    </div>
                    <code className="text-xs text-muted-foreground break-all block mt-2">{lic.license_key}</code>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Emitida {new Date(lic.issued_at).toLocaleDateString()} · Expira{" "}
                      {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : "sin caducidad"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-xs">Terminales</Label>
                    <Input
                      type="number" min={1} className="w-20"
                      defaultValue={lic.max_terminals}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== lic.max_terminals) updateMax(lic, v); }}
                    />
                    <span className="text-xs text-muted-foreground">{used} / {lic.max_terminals}</span>
                    <Button variant="outline" size="sm"
                      onClick={() => navigator.clipboard.writeText(lic.license_key).then(() => toast.success("Copiado"))}>
                      <Copy className="h-4 w-4 mr-1" /> Clave
                    </Button>
                    {lic.status === "active" ? (
                      <Button variant="destructive" size="sm" onClick={() => setStatus(lic, "suspended")} title="Suspender">
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setStatus(lic, "active")} title="Reactivar">
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Terminales de esta licencia */}
                <div className="border-t pt-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Terminales ({activations.filter((a) => a.license_id === lic.id).length})
                  </p>
                  <div className="space-y-1">
                    {activations.filter((a) => a.license_id === lic.id).length === 0 && (
                      <p className="text-xs text-muted-foreground">Sin activaciones aún.</p>
                    )}
                    {activations
                      .filter((a) => a.license_id === lic.id)
                      .map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Cpu size={12} className="text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{a.hostname ?? "(sin nombre)"}</span>
                            <span className="text-muted-foreground">· {a.platform} v{a.app_version ?? "?"}</span>
                          </div>
                          {a.revoked_at ? (
                            <Badge variant="destructive" className="text-[10px]">Revocado</Badge>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => revokeActivation(a)}>
                              Revocar
                            </Button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
