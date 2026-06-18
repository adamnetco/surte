import { useEffect, useState } from "react";
import { Copy, Check, ChevronRight, ChevronLeft, Loader2, Globe, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  loadCfAccounts,
  loadDomainDraft,
  saveDomainDraft,
  mockConnect,
  mockAdvanceStatus,
  type DnsMode,
  type DomainDraft,
} from "@/modules/superadmin/lib/cloudflareDrafts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  domain: { id: string; hostname: string } | null;
}

const SSL_PROGRESS: Record<NonNullable<DomainDraft["cf_ssl_status"]>, number> = {
  initializing: 10,
  pending_validation: 30,
  pending_issuance: 65,
  active: 100,
  failed: 100,
};

/**
 * 3-step wizard para conectar un dominio del cliente a Cloudflare.
 * 1) Selecciona modo DNS (SaaS / cuenta propia / manual)
 * 2) Muestra CNAME + TXT DCV (copy-to-clipboard)
 * 3) Polling de status con barra de progreso
 *
 * Mientras Cloud + edge functions no estén disponibles, usa los mocks de
 * `cloudflareDrafts.ts`. Cuando Cloud vuelva, reemplazar `mockConnect` /
 * `mockAdvanceStatus` por `supabase.functions.invoke('cloudflare-domain-*')`.
 */
export default function DomainWizard({ open, onOpenChange, orgId, domain }: Props) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<DnsMode>("saas");
  const [accountId, setAccountId] = useState("");
  const [draft, setDraft] = useState<DomainDraft | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);

  const accounts = orgId ? loadCfAccounts(orgId) : [];

  // Hidrata desde localStorage al abrir o al cambiar de dominio:
  // si el usuario ya había avanzado, recuperamos el paso correspondiente
  // (registros DNS o status SSL) en lugar de volver al paso 1.
  useEffect(() => {
    if (!open || !domain) return;
    setHydrating(true);
    const existing = loadDomainDraft(domain.id);
    if (existing) {
      setDraft(existing);
      setMode(existing.dns_mode);
      if (existing.cf_account_id) setAccountId(existing.cf_account_id);
      // Si ya hay status SSL → vamos a paso 3; si solo hay registros → paso 2
      if (existing.cf_ssl_status) setStep(3);
      else if (existing.cname_target || existing.cf_ownership_verification) setStep(2);
      else setStep(1);
    } else {
      setStep(1);
      setMode("saas");
      setAccountId("");
      setDraft(null);
    }
    setCopied(null);
    setChecking(false);
    // pequeño delay para que el usuario perciba el restore (evita flash)
    const t = setTimeout(() => setHydrating(false), 150);
    return () => clearTimeout(t);
  }, [open, domain?.id]);

  const restart = () => {
    if (!domain) return;
    if (!window.confirm("Vas a reiniciar el wizard de este dominio y perder el progreso guardado. ¿Continuar?")) return;
    try {
      const raw = localStorage.getItem("sistecpos:cf_domains:draft");
      if (raw) {
        const all = JSON.parse(raw) as DomainDraft[];
        localStorage.setItem(
          "sistecpos:cf_domains:draft",
          JSON.stringify(all.filter((d) => d.domain_id !== domain.id)),
        );
      }
    } catch { /* noop */ }
    setStep(1);
    setMode("saas");
    setAccountId("");
    setDraft(null);
    setCopied(null);
    toast.success("Wizard reiniciado");
  };

  // Cerrar NO resetea estado: el progreso queda persistido en localStorage
  // y la próxima apertura lo rehidratará. Esto evita perder el contexto
  // cuando el usuario cierra para copiar el CNAME al panel del cliente.
  const handleClose = (v: boolean) => {
    onOpenChange(v);
  };

  const goConnect = () => {
    if (!domain) return;
    if (mode === "cloudflare_account" && !accountId) {
      return toast.error("Selecciona la cuenta Cloudflare");
    }
    const existing = loadDomainDraft(domain.id);
    const next = existing ?? { ...mockConnect(domain.hostname, mode), domain_id: domain.id };
    next.dns_mode = mode;
    if (mode === "cloudflare_account") next.cf_account_id = accountId;
    saveDomainDraft(next);
    setDraft(next);
    setStep(2);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const verify = async () => {
    if (!draft) return;
    setChecking(true);
    await new Promise((r) => setTimeout(r, 900)); // simulated propagation delay
    const next = mockAdvanceStatus(draft);
    saveDomainDraft(next);
    setDraft(next);
    setChecking(false);
    if (next.cf_ssl_status === "active") {
      toast.success("Dominio activo en Cloudflare");
    } else {
      toast.info(`Estado: ${next.cf_ssl_status}. Volveremos a chequear cuando hagas click.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe size={18} className="text-primary" />
            <span className="flex-1 truncate">Conectar dominio {domain ? `· ${domain.hostname}` : ""}</span>
            {draft && (
              <Button
                variant="ghost"
                size="sm"
                onClick={restart}
                className="text-xs h-7"
                title="Reiniciar wizard de este dominio"
              >
                <RotateCcw size={12} className="mr-1" /> Reiniciar
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {["Modo DNS", "Registros", "Verificación"].map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                      ? "bg-success text-success-foreground"
                      : "bg-muted"
                  }`}
                >
                  {done ? <Check size={12} /> : n}
                </span>
                <span className={active ? "text-foreground font-medium" : ""}>{label}</span>
                {n < 3 && <ChevronRight size={12} />}
              </li>
            );
          })}
        </ol>

        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs flex gap-2 items-start">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>
            Lovable Cloud no está disponible. El wizard usa valores simulados para que puedas
            validar el flujo. Al volver el backend, ejecutará las edge functions reales.
          </span>
        </div>

        {hydrating && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Recuperando progreso guardado…
          </div>
        )}

        {!hydrating && (
        <>


        {/* STEP 1 — Modo DNS */}
        {step === 1 && (
          <div className="space-y-3 mt-2">
            {(
              [
                {
                  v: "saas" as const,
                  title: "Cloudflare SaaS (recomendado)",
                  desc: "Sistecpos administra el certificado. El cliente solo crea un CNAME.",
                },
                {
                  v: "cloudflare_account" as const,
                  title: "Cuenta Cloudflare del cliente",
                  desc: "Usa un API token de la cuenta del cliente para crear Custom Hostname.",
                },
                {
                  v: "manual" as const,
                  title: "DNS manual (A record)",
                  desc: "El cliente apunta su A record a la IP. Sin Cloudflare.",
                },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setMode(opt.v)}
                className={`w-full text-left p-3 rounded-md border transition ${
                  mode === opt.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="font-medium text-sm">{opt.title}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}

            {mode === "cloudflare_account" && (
              <div>
                <Label>Cuenta Cloudflare</Label>
                {accounts.length === 0 ? (
                  <p className="text-xs text-destructive">
                    No hay cuentas configuradas. Añade una en la pestaña "Cloudflare" primero.
                  </p>
                ) : (
                  <select
                    className="w-full h-10 border rounded-md bg-background px-3 text-sm"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    <option value="">Selecciona…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} {a.is_default ? "(default)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={goConnect} disabled={!domain}>
                Continuar <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Registros DNS */}
        {step === 2 && draft && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Pídele al cliente que cree estos registros en su DNS:
            </p>

            {draft.cname_target && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">CNAME</Badge>
                  <button
                    className="text-xs flex items-center gap-1 hover:text-primary"
                    onClick={() => copy(draft.cname_target!, "cname")}
                  >
                    {copied === "cname" ? <Check size={12} /> : <Copy size={12} />} Copiar
                  </button>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 text-xs">
                  <span className="text-muted-foreground">Name:</span>
                  <code className="break-all">{domain?.hostname}</code>
                  <span className="text-muted-foreground">Target:</span>
                  <code className="break-all">{draft.cname_target}</code>
                </div>
              </div>
            )}

            {draft.cf_ownership_verification && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">TXT (DCV)</Badge>
                  <button
                    className="text-xs flex items-center gap-1 hover:text-primary"
                    onClick={() => copy(draft.cf_ownership_verification!.value, "txt")}
                  >
                    {copied === "txt" ? <Check size={12} /> : <Copy size={12} />} Copiar valor
                  </button>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 text-xs">
                  <span className="text-muted-foreground">Name:</span>
                  <code className="break-all">{draft.cf_ownership_verification.name}</code>
                  <span className="text-muted-foreground">Value:</span>
                  <code className="break-all">{draft.cf_ownership_verification.value}</code>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft size={14} /> Atrás
              </Button>
              <Button onClick={() => setStep(3)}>
                Verificar <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Status polling */}
        {step === 3 && draft && (
          <div className="space-y-4 mt-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Estado SSL</span>
                <Badge
                  className={
                    draft.cf_ssl_status === "active"
                      ? "bg-success text-success-foreground"
                      : draft.cf_ssl_status === "failed"
                      ? "bg-destructive text-destructive-foreground"
                      : ""
                  }
                  variant={draft.cf_ssl_status === "active" ? "default" : "secondary"}
                >
                  {draft.cf_ssl_status ?? "pending"}
                </Badge>
              </div>
              <Progress value={SSL_PROGRESS[draft.cf_ssl_status ?? "pending_validation"]} />
              <p className="text-[11px] text-muted-foreground mt-1">
                pending_validation → pending_issuance → active
              </p>
            </div>

            {draft.last_checked_at && (
              <p className="text-xs text-muted-foreground">
                Última verificación: {new Date(draft.last_checked_at).toLocaleString()}
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ChevronLeft size={14} /> Atrás
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={verify} disabled={checking || draft.cf_ssl_status === "active"}>
                  {checking ? <Loader2 size={14} className="animate-spin" /> : "Verificar ahora"}
                </Button>
                <Button onClick={() => handleClose(false)} disabled={draft.cf_ssl_status !== "active"}>
                  Finalizar
                </Button>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
