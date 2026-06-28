import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Headphones,
  Loader2,
  PauseCircle,
  PiggyBank,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Sub = {
  id: string;
  plan: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type ReasonCode =
  | "too_expensive"
  | "missing_feature"
  | "too_complex"
  | "bug_or_quality"
  | "switching_competitor"
  | "temporary_pause"
  | "not_using"
  | "other";

const REASONS: { code: ReasonCode; label: string; hint: string }[] = [
  { code: "too_expensive", label: "Es muy costoso para mi negocio", hint: "Hablemos de un plan o descuento." },
  { code: "missing_feature", label: "Le falta una funcionalidad que necesito", hint: "Queremos saber cuál." },
  { code: "too_complex", label: "Es complejo o no entiendo cómo usarlo", hint: "Tenemos onboarding 1-a-1 gratuito." },
  { code: "bug_or_quality", label: "Tuve errores o problemas técnicos", hint: "Soporte prioritario disponible." },
  { code: "switching_competitor", label: "Voy a usar otra herramienta", hint: "¿Cuál?, nos ayuda a mejorar." },
  { code: "temporary_pause", label: "Es una pausa temporal", hint: "Podemos pausar tu cobro." },
  { code: "not_using", label: "Ya no lo necesito / cerré el negocio", hint: "Lamentamos verte ir." },
  { code: "other", label: "Otra razón", hint: "" },
];

type Offer =
  | { kind: "discount"; label: string; copy: string }
  | { kind: "pause"; label: string; copy: string }
  | { kind: "support"; label: string; copy: string }
  | { kind: "downgrade"; label: string; copy: string }
  | { kind: "feedback"; label: string; copy: string };

function offerForReason(r: ReasonCode): Offer {
  switch (r) {
    case "too_expensive":
      return {
        kind: "discount",
        label: "30% off por 3 meses",
        copy: "Aplica un descuento del 30% durante los próximos 3 ciclos en tu plan actual.",
      };
    case "temporary_pause":
      return {
        kind: "pause",
        label: "Pausa hasta 2 meses",
        copy: "Pausamos tu cobro y conservamos toda tu información durante 60 días.",
      };
    case "too_complex":
    case "bug_or_quality":
      return {
        kind: "support",
        label: "Sesión gratis con un especialista",
        copy: "Agenda una llamada de 45 min con nuestro equipo para resolver todo lo que necesites.",
      };
    case "missing_feature":
      return {
        kind: "feedback",
        label: "Cuéntanos qué te falta",
        copy: "Tu feedback va directo al equipo de producto. Revisamos cada solicitud.",
      };
    case "switching_competitor":
      return {
        kind: "discount",
        label: "20% off por 6 meses",
        copy: "Antes de cambiar, podemos igualar condiciones con un 20% de descuento por medio año.",
      };
    case "not_using":
      return {
        kind: "downgrade",
        label: "Cambia al plan Free",
        copy: "Conserva tu cuenta sin cobros. Vuelve cuando lo necesites.",
      };
    default:
      return {
        kind: "feedback",
        label: "Queremos entender",
        copy: "Compártenos qué podemos mejorar.",
      };
  }
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function BillingCancel() {
  const { currentOrg } = useOrganization();
  const navigate = useNavigate();
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<ReasonCode | null>(null);
  const [detail, setDetail] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Cancelar suscripción · SistecPOS";
  }, []);

  useEffect(() => {
    if (!currentOrg?.id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("subscriptions")
        .select("id, plan, status, billing_cycle, current_period_end, cancel_at_period_end")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      setSub((data as Sub) || null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [currentOrg?.id]);

  const offer = useMemo(() => (reason ? offerForReason(reason) : null), [reason]);

  async function logCancellation(outcome: "retained" | "scheduled_cancel", acceptedOffer: boolean) {
    if (!currentOrg?.id || !reason) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("subscription_cancellations").insert({
      organization_id: currentOrg.id,
      subscription_id: sub?.id ?? null,
      user_id: u.user?.id ?? null,
      reason_code: reason,
      reason_detail: detail || null,
      offer_shown: offer?.kind ?? null,
      offer_accepted: acceptedOffer,
      outcome,
      competitor: competitor || null,
      plan_at_cancel: sub?.plan ?? null,
    });
  }

  async function acceptOffer() {
    if (!offer || !reason) return;
    setBusy(true);
    try {
      await logCancellation("retained", true);
      toast({
        title: "¡Gracias por quedarte!",
        description:
          offer.kind === "pause"
            ? "Un especialista te contactará para configurar la pausa."
            : offer.kind === "support"
              ? "Te contactaremos en menos de 24h para agendar la sesión."
              : offer.kind === "discount"
                ? "Aplicaremos el descuento en tu próximo ciclo."
                : "Recibimos tu feedback. ¡Gracias!",
      });
      navigate("/billing/overview");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    if (!currentOrg?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_subscription_cancel_at_period_end" as any, {
        p_org_id: currentOrg.id,
        p_cancel: true,
      });
      if (error) throw error;
      await logCancellation("scheduled_cancel", false);
      toast({
        title: "Cancelación agendada",
        description: sub?.current_period_end
          ? `Conservas el acceso hasta ${fmtDate(sub.current_period_end)}.`
          : "Conservas el acceso hasta el final del ciclo actual.",
      });
      navigate("/billing/plan");
    } catch (e: any) {
      toast({ title: "No pudimos agendar la cancelación", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="h-40 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!sub || sub.cancel_at_period_end) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Card className="p-6 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-xl font-semibold">
            {sub?.cancel_at_period_end ? "Tu suscripción ya está agendada para cancelarse" : "No hay suscripción activa"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sub?.cancel_at_period_end
              ? `Conservas el acceso hasta ${fmtDate(sub.current_period_end)}. Puedes reactivar cuando quieras.`
              : "No encontramos una suscripción activa que cancelar."}
          </p>
          <Button asChild>
            <Link to="/billing/plan">Volver al plan</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/billing/plan">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al plan
          </Link>
        </Button>
        <Badge variant="outline">Paso {step} de 3</Badge>
      </div>

      {step === 1 && (
        <Card className="p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">¿Por qué quieres cancelar?</h1>
            <p className="text-sm text-muted-foreground">
              Tu respuesta nos ayuda a mejorar y a ofrecerte algo más útil antes de despedirnos.
            </p>
          </div>

          <RadioGroup value={reason ?? ""} onValueChange={(v) => setReason(v as ReasonCode)} className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r.code}
                htmlFor={`r-${r.code}`}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                  reason === r.code ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <RadioGroupItem id={`r-${r.code}`} value={r.code} className="mt-1" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.label}</div>
                  {r.hint && <div className="text-xs text-muted-foreground">{r.hint}</div>}
                </div>
              </label>
            ))}
          </RadioGroup>

          {reason === "switching_competitor" && (
            <div className="space-y-1.5">
              <Label htmlFor="competitor">¿A cuál herramienta?</Label>
              <Input
                id="competitor"
                placeholder="Ej. Alegra, Siigo, Loyverse…"
                value={competitor}
                onChange={(e) => setCompetitor(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="detail">Cuéntanos más (opcional)</Label>
            <Textarea
              id="detail"
              rows={3}
              placeholder="Lo que quieras compartir nos ayuda a mejorar."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button disabled={!reason} onClick={() => setStep(2)}>
              Continuar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && offer && (
        <Card className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              {offer.kind === "discount" ? (
                <PiggyBank className="h-6 w-6" />
              ) : offer.kind === "pause" ? (
                <PauseCircle className="h-6 w-6" />
              ) : offer.kind === "support" ? (
                <Headphones className="h-6 w-6" />
              ) : offer.kind === "downgrade" ? (
                <ArrowLeft className="h-6 w-6" />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{offer.label}</h2>
              <p className="text-sm text-muted-foreground mt-1">{offer.copy}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Conservas todos tus datos e historial
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Sin penalizaciones ni permanencia
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Puedes cancelar después si la oferta no te ayuda
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setStep(3)} disabled={busy}>
              No, gracias. Quiero cancelar
            </Button>
            <Button onClick={acceptOffer} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Aceptar oferta
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Confirmar cancelación</h1>
            <p className="text-sm text-muted-foreground">
              Tu suscripción quedará agendada para cancelarse al final del ciclo actual.
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan actual</span>
              <span className="font-medium capitalize">{sub.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Acceso hasta</span>
              <span className="font-medium">{fmtDate(sub.current_period_end)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Después de esa fecha</span>
              <span className="font-medium">Cuenta en modo lectura</span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm">
            Puedes reactivar la suscripción en cualquier momento antes de la fecha de corte desde
            <Link to="/billing/plan" className="underline ml-1">
              tu plan
            </Link>
            .
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setStep(2)} disabled={busy}>
              Volver
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Confirmar cancelación
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
