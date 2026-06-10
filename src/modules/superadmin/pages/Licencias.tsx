import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, KeyRound, Plus, ShieldCheck, ShieldOff, Cpu, Building2, Settings, Sparkles, Copy, ArrowRight } from "lucide-react";

type OnboardingProgress = {
  organization_id: string;
  company_done: boolean;
  location_done: boolean;
  modules_done: boolean;
  einvoice_done: boolean;
  catalog_done: boolean;
  completed_at: string | null;
};

const ONB_STEPS: Array<keyof OnboardingProgress> = ["company_done", "location_done", "modules_done", "einvoice_done", "catalog_done"];
function onbPct(p?: OnboardingProgress) {
  if (!p) return 0;
  const done = ONB_STEPS.filter((k) => p[k]).length;
  return Math.round((done / ONB_STEPS.length) * 100);
}

type License = {
  id: string;
  organization_id: string;
  license_key: string;
  plan: string;
  status: string;
  max_terminals: number;
  expires_at: string | null;
  issued_at: string;
  notes: string | null;
};

type Activation = {
  id: string;
  license_id: string;
  machine_fingerprint: string;
  hostname: string | null;
  platform: string | null;
  app_version: string | null;
  last_heartbeat_at: string;
  revoked_at: string | null;
};

type Release = {
  id: string;
  version: string;
  platform: string;
  channel: string;
  download_url: string;
  is_current: boolean;
  published_at: string;
  size_bytes: number | null;
};

type Org = { id: string; name: string };

export default function Licencias() {
  const { user } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [onboarding, setOnboarding] = useState<Record<string, OnboardingProgress>>({});

  // Issue dialog
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueOrg, setIssueOrg] = useState("");
  const [issuePlan, setIssuePlan] = useState("pro");
  const [issueMax, setIssueMax] = useState(3);
  const [issueExpires, setIssueExpires] = useState("");

  // Post-issue success dialog
  const [issuedInfo, setIssuedInfo] = useState<{ license_key: string; organization_id: string; plan: string } | null>(null);

  // Release dialog
  const [relOpen, setRelOpen] = useState(false);
  const [relVersion, setRelVersion] = useState("");
  const [relPlatform, setRelPlatform] = useState("win32");
  const [relUrl, setRelUrl] = useState("");
  const [relNotes, setRelNotes] = useState("");

  const navigate = useNavigate();
  const { switchOrg, refresh: refreshOrgs } = useOrganization();

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const sa = !!roles?.some((r: any) => r.role === "superadmin");
      setIsSuperadmin(sa);
      if (!sa) { setLoading(false); return; }
      await loadAll();
      setLoading(false);
    })();
  }, [user]);

  async function loadAll() {
    const [l, a, r, o, p] = await Promise.all([
      supabase.from("licenses").select("*").order("created_at", { ascending: false }),
      supabase.from("license_activations").select("*").order("last_heartbeat_at", { ascending: false }),
      supabase.from("desktop_releases").select("*").order("published_at", { ascending: false }),
      supabase.from("organizations").select("id,name").order("name"),
      supabase.from("onboarding_progress").select("organization_id,company_done,location_done,modules_done,einvoice_done,catalog_done,completed_at"),
    ]);
    setLicenses((l.data as any) ?? []);
    setActivations((a.data as any) ?? []);
    setReleases((r.data as any) ?? []);
    setOrgs((o.data as any) ?? []);
    const map: Record<string, OnboardingProgress> = {};
    ((p.data as any) ?? []).forEach((row: OnboardingProgress) => { map[row.organization_id] = row; });
    setOnboarding(map);
  }

  async function issueLicense() {
    if (!issueOrg) return toast.error("Selecciona organización");
    const { data, error } = await supabase.functions.invoke("license-issue", {
      body: {
        organization_id: issueOrg,
        plan: issuePlan,
        max_terminals: issueMax,
        expires_at: issueExpires || null,
      },
    });
    if (error) return toast.error(error.message);
    toast.success("Licencia emitida y activa");
    setIssueOpen(false);
    // Asegura registro de onboarding para que la organización pueda continuar
    await supabase.from("onboarding_progress").upsert(
      { organization_id: issueOrg },
      { onConflict: "organization_id" },
    );
    await loadAll();
    await refreshOrgs();
    if ((data as any)?.license_key) {
      setIssuedInfo({
        license_key: (data as any).license_key,
        organization_id: issueOrg,
        plan: issuePlan,
      });
      navigator.clipboard?.writeText((data as any).license_key).catch(() => {});
    }
  }

  function goConfigureOrg(orgId: string) {
    switchOrg(orgId);
    setIssuedInfo(null);
    // pequeño delay para que el provider persista currentOrgId en localStorage
    setTimeout(() => navigate(`/onboarding?org=${orgId}`), 50);
  }

  async function updateMax(lic: License, newMax: number) {
    const { error } = await supabase.from("licenses").update({ max_terminals: newMax }).eq("id", lic.id);
    if (error) return toast.error(error.message);
    toast.success("Terminales actualizados");
    await loadAll();
  }

  async function setStatus(lic: License, status: string) {
    const { error } = await supabase.from("licenses").update({ status }).eq("id", lic.id);
    if (error) return toast.error(error.message);
    toast.success(`Licencia ${status}`);
    await loadAll();
  }

  async function revokeActivation(a: Activation) {
    if (!confirm(`¿Revocar terminal ${a.hostname ?? a.machine_fingerprint.slice(0, 8)}?`)) return;
    const { error } = await supabase.from("license_activations")
      .update({ revoked_at: new Date().toISOString(), revoke_reason: "manual" })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Terminal revocada");
    await loadAll();
  }

  async function addRelease() {
    if (!relVersion || !relUrl) return toast.error("Versión y URL requeridas");
    const { error } = await supabase.from("desktop_releases").insert({
      version: relVersion, platform: relPlatform, channel: "stable",
      download_url: relUrl, release_notes: relNotes, is_current: false,
    });
    if (error) return toast.error(error.message);
    toast.success("Release publicada");
    setRelOpen(false);
    setRelVersion(""); setRelUrl(""); setRelNotes("");
    await loadAll();
  }

  async function markCurrent(r: Release) {
    await supabase.from("desktop_releases").update({ is_current: false }).eq("platform", r.platform);
    const { error } = await supabase.from("desktop_releases").update({ is_current: true }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Versión actual actualizada");
    await loadAll();
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;
  if (!user) return <div className="p-8 text-center">Inicia sesión</div>;
  if (!isSuperadmin) return <div className="p-8 text-center text-destructive">Solo superadmin</div>;

  const orgName = (id: string) => orgs.find(o => o.id === id)?.name ?? id.slice(0, 8);
  const currentByPlatform = releases.filter(r => r.is_current);

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-primary" /> Licenciamiento SISTECPOS CORE
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de licencias Ed25519, terminales activos y releases del cliente Desktop.</p>
        </div>
      </div>

      <Tabs defaultValue="licenses">
        <TabsList>
          <TabsTrigger value="licenses">Licencias</TabsTrigger>
          <TabsTrigger value="activations">Terminales</TabsTrigger>
          <TabsTrigger value="releases">Descargas Desktop</TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">{licenses.length} licencias emitidas</h2>
            <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Emitir nueva</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Emitir licencia</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Organización</Label>
                    <Select value={issueOrg} onValueChange={setIssueOrg}>
                      <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                      <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Plan</Label>
                      <Select value={issuePlan} onValueChange={setIssuePlan}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Máx. terminales</Label>
                      <Input type="number" min={1} value={issueMax} onChange={(e) => setIssueMax(Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label>Expira (opcional)</Label>
                    <Input type="date" value={issueExpires} onChange={(e) => setIssueExpires(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={issueLicense}>Emitir</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3">
            {licenses.map(lic => {
              const used = activations.filter(a => a.license_id === lic.id && !a.revoked_at).length;
              const prog = onboarding[lic.organization_id];
              const pct = onbPct(prog);
              const complete = !!prog?.completed_at || pct === 100;
              return (
                <Card key={lic.id} className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        <Building2 className="h-4 w-4 shrink-0" /> {orgName(lic.organization_id)}
                        <Badge variant={lic.status === "active" ? "default" : "destructive"}>{lic.status}</Badge>
                        <Badge variant="outline">{lic.plan}</Badge>
                        {complete
                          ? <Badge className="bg-success text-success-foreground hover:bg-success/90">Onboarding 100%</Badge>
                          : <Badge variant="secondary">Onboarding {pct}%</Badge>}
                      </div>
                      <code className="text-xs text-muted-foreground break-all">{lic.license_key}</code>
                      <div className="text-xs text-muted-foreground mt-1">
                        Emitida {new Date(lic.issued_at).toLocaleDateString()} · Expira {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : "sin caducidad"}
                      </div>
                      {!complete && (
                        <div className="mt-2 max-w-md">
                          <Progress value={pct} className="h-1.5" />
                          <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                            {ONB_STEPS.map((k) => (
                              <span key={k} className={prog?.[k] ? "text-success" : ""}>
                                {prog?.[k] ? "✓" : "○"} {k.replace("_done", "")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="text-xs">Terminales</Label>
                      <Input type="number" min={1} className="w-20" defaultValue={lic.max_terminals}
                        onBlur={(e) => { const v = Number(e.target.value); if (v !== lic.max_terminals) updateMax(lic, v); }} />
                      <span className="text-xs text-muted-foreground">{used} / {lic.max_terminals}</span>
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(lic.license_key).then(() => toast.success("Copiado"))}>
                        <Copy className="h-4 w-4 mr-1" /> Clave
                      </Button>
                      <Button size="sm" onClick={() => goConfigureOrg(lic.organization_id)} disabled={lic.status !== "active"}>
                        <Settings className="h-4 w-4 mr-1" /> {complete ? "Reconfigurar" : "Configurar"}
                      </Button>
                      {lic.status === "active"
                        ? <Button variant="destructive" size="sm" onClick={() => setStatus(lic, "suspended")} title="Suspender"><ShieldOff className="h-4 w-4" /></Button>
                        : <Button size="sm" onClick={() => setStatus(lic, "active")} title="Reactivar"><ShieldCheck className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                </Card>
              );
            })}
            {licenses.length === 0 && <p className="text-center text-muted-foreground p-8">Sin licencias aún. Emite la primera.</p>}
          </div>
        </TabsContent>

        <TabsContent value="activations" className="space-y-3">
          <h2 className="font-semibold">{activations.filter(a => !a.revoked_at).length} terminales activos</h2>
          <div className="grid gap-2">
            {activations.map(a => {
              const lic = licenses.find(l => l.id === a.license_id);
              return (
                <Card key={a.id} className="p-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{a.hostname ?? "(sin nombre)"} <span className="text-xs text-muted-foreground">· {a.platform} · v{a.app_version ?? "?"}</span></div>
                      <code className="text-[10px] text-muted-foreground">{a.machine_fingerprint.slice(0, 24)}…</code>
                      <div className="text-xs text-muted-foreground">Último heartbeat: {new Date(a.last_heartbeat_at).toLocaleString()} · {lic ? orgName(lic.organization_id) : "?"}</div>
                    </div>
                  </div>
                  <div>
                    {a.revoked_at
                      ? <Badge variant="destructive">Revocado</Badge>
                      : <Button size="sm" variant="outline" onClick={() => revokeActivation(a)}>Revocar</Button>}
                  </div>
                </Card>
              );
            })}
            {activations.length === 0 && <p className="text-center text-muted-foreground p-8">Sin activaciones todavía.</p>}
          </div>
        </TabsContent>

        <TabsContent value="releases" className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Versiones del cliente Desktop</h2>
            <Dialog open={relOpen} onOpenChange={setRelOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nueva release</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Publicar release</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Versión</Label><Input value={relVersion} onChange={(e) => setRelVersion(e.target.value)} placeholder="1.0.0" /></div>
                    <div>
                      <Label>Plataforma</Label>
                      <Select value={relPlatform} onValueChange={setRelPlatform}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="win32">Windows</SelectItem>
                          <SelectItem value="darwin">macOS</SelectItem>
                          <SelectItem value="linux">Linux</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>URL de descarga</Label><Input value={relUrl} onChange={(e) => setRelUrl(e.target.value)} placeholder="https://…" /></div>
                  <div><Label>Notas</Label><Input value={relNotes} onChange={(e) => setRelNotes(e.target.value)} /></div>
                  <Button className="w-full" onClick={addRelease}>Publicar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {currentByPlatform.length > 0 && (
            <Card className="p-4 bg-primary/5">
              <h3 className="font-semibold mb-2">Versiones actuales</h3>
              <div className="grid md:grid-cols-3 gap-3">
                {currentByPlatform.map(r => (
                  <a key={r.id} href={r.download_url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent">
                    <div>
                      <div className="text-sm font-semibold">{r.platform}</div>
                      <div className="text-xs text-muted-foreground">v{r.version}</div>
                    </div>
                    <Download className="h-5 w-5 text-primary" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          <div className="grid gap-2">
            {releases.map(r => (
              <Card key={r.id} className="p-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium text-sm">
                    v{r.version} <Badge variant="outline">{r.platform}</Badge> {r.is_current && <Badge>actual</Badge>}
                  </div>
                  <a href={r.download_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">{r.download_url}</a>
                  <div className="text-xs text-muted-foreground">{new Date(r.published_at).toLocaleString()}</div>
                </div>
                {!r.is_current && <Button size="sm" variant="outline" onClick={() => markCurrent(r)}>Marcar actual</Button>}
              </Card>
            ))}
            {releases.length === 0 && <p className="text-center text-muted-foreground p-8">Sin releases publicadas.</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Post-issue success dialog: guía al superadmin al siguiente paso */}
      <Dialog open={!!issuedInfo} onOpenChange={(o) => !o && setIssuedInfo(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Licencia activa
            </DialogTitle>
            <DialogDescription>
              {issuedInfo && `Listo para ${orgName(issuedInfo.organization_id)}. Plan ${issuedInfo.plan}. La clave ya está en tu portapapeles.`}
            </DialogDescription>
          </DialogHeader>
          {issuedInfo && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Clave de licencia</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs break-all flex-1">{issuedInfo.license_key}</code>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(issuedInfo.license_key).then(() => toast.success("Copiada"))}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Button className="w-full justify-between" onClick={() => goConfigureOrg(issuedInfo.organization_id)}>
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Configurar tienda ahora</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {releases.find((r) => r.is_current) && (
                  <a
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    href={releases.find((r) => r.is_current)?.download_url}
                    target="_blank" rel="noreferrer"
                  >
                    <span className="flex items-center gap-2"><Download className="h-4 w-4" /> Descargar SistecPOS Desktop</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: el wizard de configuración cubre nombre del negocio, sucursal, módulos y facturación. Toma menos de 2 minutos.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssuedInfo(null)}>Más tarde</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
