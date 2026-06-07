import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { FileText, RefreshCw, Send } from "lucide-react";

interface Config {
  id?: string;
  environment: "dev" | "prod";
  nit: string;
  dv?: string | null;
  razon_social?: string | null;
  api_key: string;
  resolution_number?: string | null;
  resolution_prefix?: string | null;
  resolution_from?: number | null;
  resolution_to?: number | null;
  resolution_current?: number | null;
  is_active: boolean;
}

interface Invoice {
  id: string;
  full_number: string | null;
  document_type: string;
  customer_name: string | null;
  total: number;
  status: string;
  environment: string;
  created_at: string;
  track_id: string | null;
  last_error: string | null;
}

export default function Facturacion() {
  const { currentOrg, hasModule } = useOrganization();
  const [cfg, setCfg] = useState<Config>({
    environment: "dev", nit: "", api_key: "", is_active: false,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  const moduleOn = hasModule("einvoice_innapsis");

  const loadAll = async () => {
    if (!currentOrg) return;
    const { data: c } = await supabase
      .from("einvoice_configs")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .eq("environment", cfg.environment)
      .maybeSingle();
    if (c) setCfg(c as any);

    const { data: inv } = await supabase
      .from("electronic_invoices")
      .select("id, full_number, document_type, customer_name, total, status, environment, created_at, track_id, last_error")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setInvoices((inv as any) ?? []);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [currentOrg, cfg.environment]);

  const save = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const payload = { ...cfg, organization_id: currentOrg.id };
    const { error } = await supabase.from("einvoice_configs").upsert(payload, {
      onConflict: "organization_id,environment",
    });
    setLoading(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Configuración guardada" });
    loadAll();
  };

  const checkStatus = async (invoice_id: string) => {
    const { data, error } = await supabase.functions.invoke("innapsis-status", { body: { invoice_id } });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Consulta enviada", description: JSON.stringify(data).slice(0, 120) });
  };

  if (!currentOrg) return <div className="p-6">Selecciona una organización</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Facturación electrónica DIAN</h1>
        {!moduleOn && <Badge variant="destructive">Módulo inactivo</Badge>}
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="invoices">Documentos emitidos</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Conexión Innapsis FacturaE v30</h2>
                <p className="text-xs text-muted-foreground">Las credenciales <code>client_id</code> y <code>client_secret</code> son compartidas. Solo necesitas tu NIT y API Key entregadas por Innapsis.</p>
              </div>
              <div className="flex gap-2">
                <Button variant={cfg.environment === "dev" ? "default" : "outline"} size="sm" onClick={() => setCfg({ ...cfg, environment: "dev" })}>DEV</Button>
                <Button variant={cfg.environment === "prod" ? "default" : "outline"} size="sm" onClick={() => setCfg({ ...cfg, environment: "prod" })}>PROD</Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>NIT (saas_tenant_id)</Label><Input value={cfg.nit} onChange={(e) => setCfg({ ...cfg, nit: e.target.value })} placeholder="900738794" /></div>
              <div><Label>DV</Label><Input value={cfg.dv ?? ""} onChange={(e) => setCfg({ ...cfg, dv: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Razón social</Label><Input value={cfg.razon_social ?? ""} onChange={(e) => setCfg({ ...cfg, razon_social: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>API Key Innapsis</Label><Input type="password" value={cfg.api_key} onChange={(e) => setCfg({ ...cfg, api_key: e.target.value })} placeholder="entregada por Innapsis" /></div>
              <div><Label>Resolución DIAN</Label><Input value={cfg.resolution_number ?? ""} onChange={(e) => setCfg({ ...cfg, resolution_number: e.target.value })} /></div>
              <div><Label>Prefijo</Label><Input value={cfg.resolution_prefix ?? ""} onChange={(e) => setCfg({ ...cfg, resolution_prefix: e.target.value })} placeholder="SETP" /></div>
              <div><Label>Desde</Label><Input type="number" value={cfg.resolution_from ?? ""} onChange={(e) => setCfg({ ...cfg, resolution_from: Number(e.target.value) })} /></div>
              <div><Label>Hasta</Label><Input type="number" value={cfg.resolution_to ?? ""} onChange={(e) => setCfg({ ...cfg, resolution_to: Number(e.target.value) })} /></div>
              <div><Label>Actual</Label><Input type="number" value={cfg.resolution_current ?? ""} onChange={(e) => setCfg({ ...cfg, resolution_current: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={cfg.is_active} onCheckedChange={(v) => setCfg({ ...cfg, is_active: v })} />
                <Label>Activar emisión</Label>
              </div>
            </div>

            <Button onClick={save} disabled={loading}>Guardar configuración</Button>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Últimos 50 documentos</h2>
              <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="h-4 w-4 mr-1" /> Refrescar</Button>
            </div>
            <div className="space-y-2">
              {invoices.length === 0 && <p className="text-sm text-muted-foreground">Sin documentos aún.</p>}
              {invoices.map((i) => (
                <div key={i.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                  <div>
                    <div className="font-medium">{i.full_number ?? "—"} · {i.document_type}</div>
                    <div className="text-xs text-muted-foreground">{i.customer_name ?? "Consumidor final"} · ${i.total.toLocaleString("es-CO")} · {new Date(i.created_at).toLocaleString("es-CO")}</div>
                    {i.last_error && <div className="text-xs text-destructive">{i.last_error}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={i.status === "sent" || i.status === "accepted" ? "default" : i.status === "error" || i.status === "rejected" ? "destructive" : "secondary"}>
                      {i.status}
                    </Badge>
                    <Badge variant="outline">{i.environment}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => checkStatus(i.id)} title="Consultar estado">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
