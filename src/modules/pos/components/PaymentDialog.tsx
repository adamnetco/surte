import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Plus, Banknote, CreditCard, Smartphone, ArrowLeftRight, ShieldAlert, ShieldOff, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import DocumentTypeSelector from "./DocumentTypeSelector";
import { usePosCobroGate } from "@/modules/pos/hooks/usePosCobroGate";
import { useTipConfig } from "@/modules/pos/hooks/useTipConfig";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { toast } from "@/hooks/use-toast";

type MethodKey = "efectivo" | "tarjeta_debito" | "tarjeta_credito" | "transferencia" | "nequi" | "daviplata";

const METHODS: { key: MethodKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "efectivo", label: "Efectivo", icon: Banknote },
  { key: "tarjeta_debito", label: "Débito", icon: CreditCard },
  { key: "tarjeta_credito", label: "Crédito", icon: CreditCard },
  { key: "transferencia", label: "Transfer.", icon: ArrowLeftRight },
  { key: "nequi", label: "Nequi", icon: Smartphone },
  { key: "daviplata", label: "Daviplata", icon: Smartphone },
];

interface Pay { method: MethodKey; amount: number; reference?: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Subtotal antes de propina */
  total: number;
  onConfirm: (
    payments: Pay[],
    meta: { docType: string | null; tip: number }
  ) => void | Promise<void>;
  organizationId?: string;
  hasCustomerId?: boolean;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const QUICK_BILLS = [2_000, 5_000, 10_000, 20_000, 50_000, 100_000];

/** Devuelve el siguiente billete redondo igual o mayor al pendiente. */
function suggestedQuickAmounts(pending: number): number[] {
  if (pending <= 0) return [];
  const next = QUICK_BILLS.filter((b) => b >= pending).slice(0, 4);
  // Si pending es muy alto, ofrecer múltiplos
  if (next.length < 4) {
    const ceil = Math.ceil(pending / 50_000) * 50_000;
    const extras = [ceil, ceil + 50_000, ceil + 100_000].filter((v) => v > pending);
    next.push(...extras);
  }
  // Garantizar que aparezca también un atajo "exacto"
  return Array.from(new Set([pending, ...next])).slice(0, 5);
}

export default function PaymentDialog({ open, onOpenChange, total, onConfirm, organizationId, hasCustomerId = false }: Props) {
  const [docType, setDocType] = useState<string | null>(null);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tipPct, setTipPct] = useState<number>(0);
  const [tipCustom, setTipCustom] = useState<string>("");
  const firstAmountRef = useRef<HTMLInputElement>(null);
  const { role } = useAuth();
  const gate = usePosCobroGate(organizationId, docType);
  const { config: tipCfg } = useTipConfig(organizationId);
  const isSuperadmin = role === "superadmin";

  const tipEnabled = tipCfg.enabled && tipCfg.mode !== "off";
  const tipAmount = useMemo(() => {
    if (!tipEnabled) return 0;
    if (tipCustom.trim() !== "") return Math.max(0, Math.round(Number(tipCustom) || 0));
    return Math.round((total * tipPct) / 100);
  }, [tipEnabled, tipPct, tipCustom, total]);
  const grandTotal = total + tipAmount;

  useEffect(() => {
    if (open) {
      // pre-seleccionar % por defecto si las propinas están activas
      const startPct = tipEnabled ? tipCfg.default_pct : 0;
      const startTip = tipEnabled ? Math.round((total * startPct) / 100) : 0;
      setTipPct(startPct);
      setTipCustom("");
      setPayments([{ method: "efectivo", amount: total + startTip }]);
      setSubmitting(false);
      // Focus + select del primer monto para tecleo inmediato.
      setTimeout(() => {
        firstAmountRef.current?.focus();
        firstAmountRef.current?.select();
      }, 60);
    }
  }, [open, total, tipEnabled, tipCfg.default_pct]);

  // AC5: Ctrl+Shift+B activa override (solo superadmin, solo si está bloqueado).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.ctrlKey && e.shiftKey && (e.key === "B" || e.key === "b") &&
        isSuperadmin && !gate.canCharge
      ) {
        e.preventDefault();
        gate.activateOverride().then(() => {
          toast({
            title: "Override hard-block activado",
            description: "TTL 30 min · acción registrada en auditoría",
            variant: "destructive",
          });
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, isSuperadmin, gate.canCharge, gate]);

  const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const change = Math.max(0, sum - total);
  const pending = Math.max(0, total - sum);
  const paymentsOk = payments.every((p) => p.amount > 0) && pending <= 0;
  const canConfirm = !submitting && paymentsOk && gate.canCharge;

  // Estado del cobro: falta / exacto / vuelto
  const statusBadge = useMemo(() => {
    if (pending > 0) return { label: `Faltan ${COP(pending)}`, cls: "bg-destructive/10 text-destructive border-destructive/30" };
    if (change > 0) return { label: `Vuelto ${COP(change)}`, cls: "bg-primary/10 text-primary border-primary/30" };
    return { label: "Cobro exacto", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
  }, [pending, change]);

  const updatePayment = (i: number, patch: Partial<Pay>) => {
    setPayments((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  };

  const doConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(payments.filter((p) => p.amount > 0), { docType });
    } catch {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canConfirm) {
      e.preventDefault();
      doConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Cobrar {COP(total)}</span>
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {organizationId && (
            <DocumentTypeSelector
              organizationId={organizationId}
              value={docType}
              onChange={(code) => setDocType(code)}
              hasCustomerId={hasCustomerId}
              compact
            />
          )}
          {payments.map((p, i) => {
            const amountId = `pay-amount-${i}`;
            const remaining = Math.max(0, total - (sum - (Number(p.amount) || 0)));
            const quick = p.method === "efectivo" ? suggestedQuickAmounts(remaining) : [];

            return (
              <div key={i} className="rounded-lg border bg-card p-2.5 space-y-2">
                {/* Chips de método */}
                <div className="flex flex-wrap gap-1">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = p.method === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => updatePayment(i, { method: m.key })}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1 px-2.5 h-8 rounded-md border text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted hover:bg-accent/20 border-border text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={amountId} className="text-[11px] text-muted-foreground">
                      {p.method === "efectivo" ? "Recibido" : "Monto"}
                    </Label>
                    <Input
                      id={amountId}
                      ref={i === 0 ? firstAmountRef : undefined}
                      type="number"
                      inputMode="numeric"
                      className="h-11 text-lg font-bold tabular-nums"
                      value={p.amount || ""}
                      onChange={(e) => updatePayment(i, { amount: Number(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  {payments.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPayments((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Eliminar pago ${i + 1}`}
                      className="h-11 w-11"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Quick-cash solo para efectivo */}
                {p.method === "efectivo" && quick.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => updatePayment(i, { amount: remaining })}
                      className="px-2.5 h-8 rounded-md border border-primary/40 bg-primary/10 text-primary text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Exacto · {COP(remaining)}
                    </button>
                    {quick.filter((v) => v !== remaining).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => updatePayment(i, { amount: v })}
                        className="px-2.5 h-8 rounded-md border bg-muted hover:bg-accent/20 text-[11px] font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {COP(v)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setPayments((prev) => [...prev, { method: "efectivo", amount: pending }])}
            disabled={pending <= 0}
          >
            <Plus className="w-4 h-4 mr-1" /> Dividir pago{pending > 0 && ` · falta ${COP(pending)}`}
          </Button>

          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="tabular-nums">{COP(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Recibido</span><span className="tabular-nums">{COP(sum)}</span></div>
            {pending > 0 && (
              <div className="flex justify-between font-semibold text-destructive">
                <span>Falta</span><span className="tabular-nums">{COP(pending)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between font-bold text-primary text-base pt-1 border-t">
                <span>Vuelto en efectivo</span><span className="tabular-nums">{COP(change)}</span>
              </div>
            )}
          </div>

          {!gate.canCharge && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-destructive">Cobro bloqueado</p>
                  <p className="text-muted-foreground mt-0.5">
                    DIAN offline y sin rango de contingencia vigente. Configura un rango o espera al restablecimiento.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                <Link to="/admin/facturacion/configuracion" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Configurar rango de contingencia
                </Link>
              </Button>
              {isSuperadmin && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={async () => {
                      await gate.activateOverride();
                      toast({
                        title: "Override hard-block activado",
                        description: "TTL 30 min · acción registrada en auditoría",
                        variant: "destructive",
                      });
                    }}
                  >
                    <ShieldOff className="h-3 w-3 mr-1" />
                    Forzar cobro (override superadmin)
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Atajo: <kbd className="px-1 py-0.5 bg-muted rounded font-mono">Ctrl+Shift+B</kbd>
                  </p>
                </>
              )}
            </div>
          )}

          {gate.overrideActive && gate.canCharge && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
              <ShieldOff className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive font-medium">Override hard-block activo · auditoría registrada</span>
            </div>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button
                    variant="cta"
                    className="w-full h-12 text-base"
                    disabled={!canConfirm}
                    onClick={doConfirm}
                  >
                    {submitting ? "Procesando…" : "Confirmar cobro"}
                    {!submitting && canConfirm && (
                      <kbd className="ml-2 px-1.5 py-0.5 bg-black/15 rounded text-[10px] font-mono">Enter</kbd>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!gate.canCharge && (
                <TooltipContent>
                  DIAN offline. Configure rango de contingencia o espere a restablecimiento.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
