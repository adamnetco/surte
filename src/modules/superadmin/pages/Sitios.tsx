import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Globe, Plus, Copy, Check, X, Trash2, ExternalLink, RefreshCw, Send, Webhook, Cloud, Wand2, Settings2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import CloudflareAccountsTab from "@/modules/superadmin/components/CloudflareAccountsTab";
import DomainWizard from "@/modules/superadmin/components/DomainWizard";
import SiteDetailsPanel from "@/modules/superadmin/components/SiteDetailsPanel";

const ASTRO_HOST_IP = "185.158.133.1"; // mismo IP base de Lovable; el cliente reenvía aquí su DNS
const SUPABASE_FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co`;

export default function Sitios() {
  const { user, role, loading } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("sites");

  useEffect(() => {
    if (!loading && !user) { toast.error("Acceso denegado"); navigate("/login"); }
    else if (!loading && !["superadmin","admin"].includes(role)) { toast.error("Solo admins"); navigate("/"); }
  }, [user, role, loading, navigate]);

  if (loading || !orgId) return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
        <AppBreadcrumb currentLabel="Sitios web" />
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Sitios web (Astro + WP headless)</h1>
          <p className="text-sm text-muted-foreground">Cada negocio puede tener su propio sitio público, WordPress headless y dominio propio.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full lg:w-auto">
            <TabsTrigger value="sites"><Globe className="w-4 h-4 mr-1" />Sitios</TabsTrigger>
            <TabsTrigger value="domains">Dominios</TabsTrigger>
            <TabsTrigger value="cloudflare"><Cloud className="w-4 h-4 mr-1" />Cloudflare</TabsTrigger>
          </TabsList>
          <TabsContent value="sites"><SitesTab orgId={orgId} qc={qc} /></TabsContent>
          <TabsContent value="domains"><DomainsTab orgId={orgId} qc={qc} /></TabsContent>
          <TabsContent value="cloudflare"><CloudflareAccountsTab orgId={orgId} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SitesTab({ orgId, qc }: { orgId: string; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", slug: "" });
  const [wpEdit, setWpEdit] = useState<any | null>(null);

  const { data: sites } = useQuery({
    queryKey: ["tenant-sites", orgId],
    queryFn: async () => (await supabase.from("tenant_sites")
      .select("*, tenant_wp_config(*), tenant_domains(hostname,is_primary,verified_at)")
      .eq("organization_id", orgId).order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    if (!form.name.trim() || !form.slug.trim()) return toast.error("Nombre y slug requeridos");
    const { error } = await supabase.from("tenant_sites").insert([{
      organization_id: orgId, name: form.name, slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    }]);
    if (error) return toast.error(error.message);
    toast.success("Sitio creado");
    setOpen(false); setForm({ name: "", slug: "" });
    qc.invalidateQueries({ queryKey: ["tenant-sites", orgId] });
  };

  const togglePublish = async (s: any) => {
    await supabase.from("tenant_sites").update({ is_published: !s.is_published }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["tenant-sites", orgId] });
  };

  const saveWp = async () => {
    if (!wpEdit?.wp_base_url) return toast.error("URL de WP requerida");
    const payload = {
      site_id: wpEdit.site_id, organization_id: orgId,
      wp_base_url: wpEdit.wp_base_url.replace(/\/$/, ""),
      wp_username: wpEdit.wp_username || null,
      wp_app_password: wpEdit.wp_app_password || null,
      wp_app_user: wpEdit.wp_app_user || wpEdit.wp_username || null,
      default_post_type: wpEdit.default_post_type || "posts",
      product_cpt: wpEdit.product_cpt || "producto",
      revalidate_url: wpEdit.revalidate_url || null,
      revalidate_token: wpEdit.revalidate_token || null,
    };
    const { error } = wpEdit.id
      ? await supabase.from("tenant_wp_config").update(payload).eq("id", wpEdit.id)
      : await supabase.from("tenant_wp_config").insert([payload]);
    if (error) return toast.error(error.message);
    toast.success("WP guardado");
    setWpEdit(null);
    qc.invalidateQueries({ queryKey: ["tenant-sites", orgId] });
  };

  const syncProducts = async (siteId: string) => {
    toast.loading("Sincronizando productos a WP…", { id: "sync" });
    const { data, error } = await supabase.functions.invoke("sync-products-to-wp", { body: { site_id: siteId, limit: 200 } });
    toast.dismiss("sync");
    if (error) return toast.error(error.message);
    toast.success(`Sync: ${data.succeeded}/${data.total} ok, ${data.failed} fallidos`);
    qc.invalidateQueries({ queryKey: ["tenant-sites", orgId] });
  };

  return (
    <div className="space-y-4">
      {/* Header con CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {sites?.length ?? 0} {sites?.length === 1 ? "sitio configurado" : "sitios configurados"}
          </p>
          <p className="text-xs text-muted-foreground/80">
            Cada sitio público consume productos del catálogo de SistecPOS Core. Las ventas se cierran en Core.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="w-4 h-4 mr-1" />Nuevo sitio</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo sitio</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre comercial</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug interno (único)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="mi-negocio" /></div>
              <Button onClick={create} className="w-full">Crear</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {sites && sites.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <Globe className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">Aún no hay sitios web</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crea un sitio para que tu negocio tenga vitrina pública con productos en vivo desde el POS.
          </p>
        </Card>
      )}

      {/* Grid de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sites?.map((s: any) => {
          const wp = s.tenant_wp_config?.[0];
          const wpConfigured = !!wp?.wp_app_password;
          const wpHost = wp?.wp_base_url ? new URL(wp.wp_base_url).hostname : null;
          const primaryDomain = s.tenant_domains?.find((d: any) => d.is_primary)?.hostname
            ?? s.tenant_domains?.[0]?.hostname;
          const verifiedDomains = s.tenant_domains?.filter((d: any) => d.verified_at).length ?? 0;
          const totalDomains = s.tenant_domains?.length ?? 0;
          const headingId = `site-${s.id}-title`;
          return (
            <Card key={s.id} role="article" aria-labelledby={headingId} className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-ring">
              {/* Header */}
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0" aria-hidden>
                  <Globe className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id={headingId} className="font-heading font-semibold text-base truncate">{s.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate">/{s.slug}</p>
                </div>
                <Badge
                  variant={s.is_published ? "default" : "secondary"}
                  className={s.is_published ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/25" : ""}
                >
                  <span aria-hidden className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.is_published ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                  {s.is_published ? "Publicado" : "Borrador"}
                </Badge>
              </div>

              {/* Status grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    {wpConfigured
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden />
                      : <AlertCircle className="w-3.5 h-3.5 text-amber-500" aria-hidden />}
                    <span className="font-medium">WordPress</span>
                    <span className="sr-only">{wpConfigured ? "configurado" : "no configurado"}</span>
                  </div>
                  {wpHost ? (
                    <a href={wp.wp_base_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate block">
                      {wpHost}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Sin configurar</span>
                  )}
                </div>

                <div className="rounded-md border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    {verifiedDomains > 0
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden />
                      : <AlertCircle className="w-3.5 h-3.5 text-amber-500" aria-hidden />}
                    <span className="font-medium">Dominio</span>
                  </div>
                  {primaryDomain ? (
                    <span className="font-mono truncate block" title={primaryDomain}>{primaryDomain}</span>
                  ) : (
                    <span className="text-muted-foreground">Sin dominio</span>
                  )}
                  {totalDomains > 0 && (
                    <span className="text-[10px] text-muted-foreground">{verifiedDomains}/{totalDomains} verificados</span>
                  )}
                </div>
              </div>

              {/* Toggle + quick actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Switch checked={s.is_published} onCheckedChange={() => togglePublish(s)} aria-label={`Publicar ${s.name}`} />
                  <span className="text-muted-foreground">Publicado</span>
                </label>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setWpEdit({ ...(wp ?? {}), site_id: s.id })} aria-label="Configurar WordPress">
                    <Settings2 className="w-3.5 h-3.5 mr-1" aria-hidden />WP
                  </Button>
                  <Button size="sm" variant="outline" disabled={!wpConfigured} onClick={() => syncProducts(s.id)} aria-label="Sincronizar productos">
                    <Send className="w-3.5 h-3.5 mr-1" aria-hidden />Sync
                  </Button>
                </div>
              </div>

              {/* Detalles expandibles / Sheet en mobile */}
              <SiteDetailsPanel
                site={s}
                onSync={() => syncProducts(s.id)}
                onTogglePublish={() => togglePublish(s)}
                onConfigWp={() => setWpEdit({ ...(wp ?? {}), site_id: s.id })}
              />
            </Card>
          );
        })}
      </div>

      {/* Diálogo WP (idéntico al original) */}
      <Dialog open={!!wpEdit} onOpenChange={(o) => !o && setWpEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>WordPress headless + revalidación Astro</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div><Label>URL base WP *</Label><Input value={wpEdit?.wp_base_url ?? ""} onChange={(e) => setWpEdit({ ...wpEdit, wp_base_url: e.target.value })} placeholder="https://blog.minegocio.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Usuario WP (Application Password)</Label><Input value={wpEdit?.wp_app_user ?? wpEdit?.wp_username ?? ""} onChange={(e) => setWpEdit({ ...wpEdit, wp_app_user: e.target.value, wp_username: e.target.value })} /></div>
              <div><Label>Application Password</Label><Input type="password" value={wpEdit?.wp_app_password ?? ""} onChange={(e) => setWpEdit({ ...wpEdit, wp_app_password: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Post type blog</Label><Input value={wpEdit?.default_post_type ?? "posts"} onChange={(e) => setWpEdit({ ...wpEdit, default_post_type: e.target.value })} /></div>
              <div><Label>CPT productos</Label><Input value={wpEdit?.product_cpt ?? "producto"} onChange={(e) => setWpEdit({ ...wpEdit, product_cpt: e.target.value })} /></div>
            </div>
            <div className="border-t pt-3 space-y-3">
              <div className="font-medium text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Revalidación de Astro al publicar en WP</div>
              <div><Label>Revalidate URL (Vercel/Netlify)</Label><Input value={wpEdit?.revalidate_url ?? ""} onChange={(e) => setWpEdit({ ...wpEdit, revalidate_url: e.target.value })} placeholder="https://misitio.vercel.app/api/revalidate" /></div>
              <div><Label>Token compartido</Label><Input value={wpEdit?.revalidate_token ?? ""} onChange={(e) => setWpEdit({ ...wpEdit, revalidate_token: e.target.value })} placeholder="secreto-compartido" /></div>
              {wpEdit?.site_id && (
                <div className="text-xs bg-muted/40 rounded-md p-3 space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1"><Webhook className="w-3 h-3" />Webhook para WP (plugin WP Webhooks o similar):</p>
                  <code className="break-all text-[10px]">{`${SUPABASE_FN_BASE}/wp-revalidate-webhook?site_id=${wpEdit.site_id}`}</code>
                  <p className="text-muted-foreground">Header <code>X-WP-Signature</code> = tu token, evento <code>post_published</code>.</p>
                </div>
              )}
            </div>
            {wpEdit?.site_id && wpEdit?.plugin_token && (
              <div className="border-t pt-3 space-y-2 text-xs bg-primary/5 rounded-md p-3">
                <p className="font-medium text-sm text-primary flex items-center gap-1"><Webhook className="w-4 h-4" />Plugin WordPress oficial (recomendado)</p>
                <p className="text-muted-foreground">Descarga el plugin, instálalo y pega estas credenciales en <em>Ajustes → Sistecpos</em>:</p>
                <div className="grid grid-cols-[80px_1fr] gap-1 items-center">
                  <span className="font-medium">Site ID:</span><code className="break-all text-[10px] bg-background px-1 rounded">{wpEdit.site_id}</code>
                  <span className="font-medium">Token:</span><code className="break-all text-[10px] bg-background px-1 rounded">{wpEdit.plugin_token}</code>
                </div>
                <a href="/wp-plugin/sistecpos-connector.php" download className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" />Descargar sistecpos-connector.php
                </a>
              </div>
            )}
            <Button onClick={saveWp} className="w-full">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DomainsTab({ orgId, qc }: { orgId: string; qc: any }) {
  const [siteId, setSiteId] = useState<string>("");
  const [hostname, setHostname] = useState("");
  const [wizardDomain, setWizardDomain] = useState<{ id: string; hostname: string } | null>(null);

  const { data: sites } = useQuery({
    queryKey: ["tenant-sites-list", orgId],
    queryFn: async () => (await supabase.from("tenant_sites").select("id,name,slug").eq("organization_id", orgId).order("name")).data ?? [],
  });
  const { data: domains } = useQuery({
    queryKey: ["tenant-domains", orgId],
    queryFn: async () => (await supabase.from("tenant_domains").select("*, tenant_sites(name,slug)")
      .eq("organization_id", orgId).order("created_at", { ascending: false })).data ?? [],
  });

  const add = async () => {
    if (!siteId || !hostname.trim()) return toast.error("Sitio y dominio requeridos");
    const clean = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const { error } = await supabase.from("tenant_domains").insert([{ site_id: siteId, organization_id: orgId, hostname: clean }]);
    if (error) return toast.error(error.message);
    toast.success("Dominio agregado. Pídele al cliente que configure el DNS.");
    setHostname("");
    qc.invalidateQueries({ queryKey: ["tenant-domains", orgId] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este dominio?")) return;
    await supabase.from("tenant_domains").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tenant-domains", orgId] });
  };

  const markVerified = async (d: any) => {
    toast.loading("Verificando DNS…", { id: "dns" });
    const { data, error } = await supabase.functions.invoke("verify-tenant-domain", { body: { domain_id: d.id } });
    toast.dismiss("dns");
    if (error) return toast.error(error.message);
    if (data?.verified) toast.success("Dominio verificado");
    else toast.error("TXT no encontrado todavía. Espera propagación DNS.");
    qc.invalidateQueries({ queryKey: ["tenant-domains", orgId] });
  };

  const setPrimary = async (d: any) => {
    await supabase.from("tenant_domains").update({ is_primary: false }).eq("site_id", d.site_id);
    await supabase.from("tenant_domains").update({ is_primary: true }).eq("id", d.id);
    qc.invalidateQueries({ queryKey: ["tenant-domains", orgId] });
  };

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Copiado"); };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-heading font-semibold text-primary">Conectar un dominio nuevo</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <Label>Sitio</Label>
            <select className="w-full h-10 border rounded-md bg-background px-3" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Selecciona…</option>
              {sites?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><Label>Dominio (ej. www.minegocio.com)</Label><Input value={hostname} onChange={(e) => setHostname(e.target.value)} /></div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Conectar</Button>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3 space-y-1">
          <p className="font-medium text-foreground">Configuración DNS que debe hacer el cliente:</p>
          <p>• <b>CNAME</b> <code>www</code> → <code>cname.vercel-dns.com</code></p>
          <p>• <b>A</b> <code>@</code> → <code>{ASTRO_HOST_IP}</code> (si quiere root sin www)</p>
          <p>• <b>TXT</b> <code>_lovable-tenant</code> → token mostrado por dominio (verificación)</p>
        </div>
      </Card>

      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Dominio</TableHead><TableHead>Sitio</TableHead>
            <TableHead>Token DNS</TableHead><TableHead>Estado</TableHead>
            <TableHead>Primario</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {domains?.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.hostname}</TableCell>
                <TableCell className="text-sm">{d.tenant_sites?.name}</TableCell>
                <TableCell>
                  <button className="text-xs font-mono inline-flex items-center gap-1 hover:text-primary" onClick={() => copy(d.verification_token)}>
                    {d.verification_token.slice(0, 10)}… <Copy className="w-3 h-3" />
                  </button>
                </TableCell>
                <TableCell>
                  {d.verified_at
                    ? <Badge className="bg-success text-success-foreground"><Check className="w-3 h-3 mr-1" />Verificado</Badge>
                    : <Badge variant="secondary"><X className="w-3 h-3 mr-1" />Pendiente</Badge>}
                </TableCell>
                <TableCell>
                  <Switch checked={d.is_primary} onCheckedChange={() => setPrimary(d)} />
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setWizardDomain({ id: d.id, hostname: d.hostname })}>
                    <Wand2 className="w-3 h-3 mr-1" />Wizard CF
                  </Button>
                  {!d.verified_at && <Button size="sm" variant="outline" onClick={() => markVerified(d)}>Verificar</Button>}
                  <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="ghost"><ExternalLink className="w-4 h-4" /></Button>
                  </a>
                  <Button size="icon" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!domains?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin dominios.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <DomainWizard
        open={!!wizardDomain}
        onOpenChange={(v) => !v && setWizardDomain(null)}
        orgId={orgId}
        domain={wizardDomain}
      />
    </div>
  );
}
