import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins, Banknote, Wand2, Loader2, Eye, EyeOff, Camera, X } from "lucide-react";
import { errorToMessage } from "@/lib/errors";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  openingAmount: number;
  organizationId: string;
  userId: string;
  onClosed: () => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const DIFF_THRESHOLD = 5_000; // COP — descuadre que dispara confirmación

interface Totals {
  cash: number; card: number; transfer: number; other: number; total: number; count: number;
}

interface Denomination {
  id: string;
  value: number;
  kind: string;
}

export default function CloseSessionDialog({ open, onOpenChange, sessionId, openingAmount, organizationId, userId, onClosed }: Props) {
  const [totals, setTotals] = useState<Totals>({ cash: 0, card: 0, transfer: 0, other: 0, total: 0, count: 0 });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [denoms, setDenoms] = useState<Denomination[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Ola 25 · Slice 1
  const [blindMode, setBlindMode] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const [{ data: pays }, { count }, { data: dens }] = await Promise.all([
          supabase.from("pos_payments").select("method,amount")
            .eq("organization_id", organizationId).eq("cash_session_id", sessionId),
          supabase.from("pos_orders").select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId).eq("cash_session_id", sessionId).eq("status", "paid"),
          supabase.from("cash_denominations").select("id,value,kind")
            .eq("currency", "COP").eq("is_active", true).order("value", { ascending: false }),
        ]);

        const t: Totals = { cash: 0, card: 0, transfer: 0, other: 0, total: 0, count: count ?? 0 };
        (pays ?? []).forEach((p: any) => {
          const a = Number(p.amount);
          t.total += a;
          if (p.method === "efectivo") t.cash += a;
          else if (p.method?.startsWith("tarjeta")) t.card += a;
          else if (["transferencia", "nequi", "daviplata"].includes(p.method)) t.transfer += a;
          else t.other += a;
        });
        setTotals(t);
        setDenoms((dens ?? []) as Denomination[]);
        setCounts({});
        setNotes("");
        setRevealed(false);
        setBlindMode(true);
        setPhotoFile(null);
        setPhotoPreview(null);
      } catch (e) {
        toast.error(errorToMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sessionId]);

  const expected = openingAmount + totals.cash;
  const countedTotal = useMemo(
    () => denoms.reduce((acc, d) => acc + Number(d.value) * (parseInt(counts[d.id] || "0", 10) || 0), 0),
    [denoms, counts]
  );
  const diff = countedTotal - expected;
  const diffAbs = Math.abs(diff);
  const isOver = diff > 0;
  const isShort = diff < 0;
  const isSquare = diff === 0;
  const significantDiff = diffAbs > DIFF_THRESHOLD;

  // Estado visual de la diferencia
  const diffStyle = isSquare
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    : isShort
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";

  const diffLabel = isSquare ? "Cuadrado" : isShort ? `Faltante ${COP(diffAbs)}` : `Sobrante ${COP(diffAbs)}`;

  /** Autocompleta el conteo greedy desde las denominaciones mayores para igualar `expected`. */
  const autoFillExpected = () => {
    let remaining = expected;
    const next: Record<string, string> = {};
    // Asume denoms ordenadas desc por value (la query lo hace).
    for (const d of denoms) {
      const v = Number(d.value);
      if (v <= 0) continue;
      const qty = Math.floor(remaining / v);
      if (qty > 0) {
        next[d.id] = String(qty);
        remaining -= qty * v;
      }
    }
    setCounts(next);
    toast.success("Conteo autocompletado al efectivo esperado");
  };

  const uploadArqueoPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;
    setUploading(true);
    try {
      const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `org-${organizationId}/sessions/${sessionId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("cash-arqueo").upload(path, photoFile, {
        upsert: false, contentType: photoFile.type || "image/jpeg",
      });
      if (error) throw error;
      return path;
    } finally {
      setUploading(false);
    }
  };

  const doClose = async () => {
    setBusy(true);
    const payload = denoms
      .map((d) => ({ denomination_id: d.id, quantity: parseInt(counts[d.id] || "0", 10) || 0 }))
      .filter((x) => x.quantity > 0);

    try {
      const photoPath = await uploadArqueoPhoto();
      const { error: upErr } = await supabase
        .from("cash_sessions")
        .update({
          expected_amount: expected,
          total_sales: totals.total,
          total_cash: totals.cash,
          total_card: totals.card,
          total_transfer: totals.transfer,
          total_other: totals.other,
          ticket_count: totals.count,
          notes,
          blind_count_enabled: blindMode,
          arqueo_photo_url: photoPath,
          arqueo_confirmed_at: new Date().toISOString(),
          arqueo_confirmed_by: userId,
        } as any)
        .eq("organization_id", organizationId)
        .eq("id", sessionId);
      if (upErr) throw upErr;

      const { error } = await supabase.rpc("close_cash_session_with_counts", {
        _session_id: sessionId,
        _counts: payload as any,
      });
      if (error) throw error;

      // Calcula y persiste hash determinístico del conteo
      const { data: hash } = await (supabase.rpc as any)("cash_session_compute_denom_hash", { p_session_id: sessionId });
      if (hash) {
        await supabase.from("cash_sessions")
          .update({ denominations_hash: hash as string } as any)
          .eq("organization_id", organizationId).eq("id", sessionId);
      }

      // Ola 25 · Slice 2 — recupera el sello fiscal emitido por el trigger
      const { data: sealRow } = await supabase
        .from("cash_session_seals")
        .select("sequence,current_hash")
        .eq("cash_session_id", sessionId)
        .maybeSingle();

      if (sealRow?.current_hash) {
        toast.success("Caja cerrada · Sello fiscal emitido", {
          description: `#${sealRow.sequence} · hash ${String(sealRow.current_hash).slice(0, 12)}…`,
          duration: 8000,
        });
      } else {
        toast.success("Caja cerrada");
      }
      onOpenChange(false);
      onClosed();
    } catch (e) {
      toast.error(errorToMessage(e));
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const attemptClose = () => {
    if (blindMode && !revealed) {
      setRevealed(true);
      toast.message(isSquare ? "Cuadrado ✓" : diffLabel, { description: "Revisa el resultado y confirma para cerrar." });
      return;
    }
    if (!isSquare && !notes.trim()) {
      toast.error("Anota el motivo del descuadre antes de cerrar");
      return;
    }
    if (significantDiff) {
      setConfirmOpen(true);
      return;
    }
    doClose();
  };

  const onPickPhoto = (f: File | null) => {
    setPhotoFile(f);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(f ? URL.createObjectURL(f) : null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cierre Z — Arqueo con denominaciones</DialogTitle></DialogHeader>

          {loading ? (
            <div className="py-10 grid place-items-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {/* Modo ciego toggle */}
              <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-start gap-2">
                  {blindMode ? <EyeOff className="w-4 h-4 mt-0.5 text-primary" /> : <Eye className="w-4 h-4 mt-0.5" />}
                  <div>
                    <div className="font-medium">Conteo a ciegas</div>
                    <p className="text-xs text-muted-foreground">
                      Oculta el efectivo esperado y la diferencia hasta que confirmes el conteo.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={blindMode}
                  disabled={revealed}
                  onCheckedChange={(v) => { setBlindMode(v); setRevealed(false); }}
                  aria-label="Activar conteo a ciegas"
                />
              </div>

              {/* Resumen de la sesión */}
              <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                <Row label="Tickets" value={String(totals.count)} />
                <Row label="Base inicial" value={COP(openingAmount)} />
                <Row label="Tarjeta" value={COP(totals.card)} />
                <Row label="Transferencia/Wallets" value={COP(totals.transfer)} />
                <Row label="Otros" value={COP(totals.other)} />
                <hr className="my-1" />
                <Row label="Ventas totales" value={COP(totals.total)} bold />
                {(!blindMode || revealed) && <>
                  <Row label="Efectivo (ventas)" value={COP(totals.cash)} />
                  <Row label="Efectivo esperado" value={COP(expected)} bold />
                </>}
                {blindMode && !revealed && (
                  <Row label="Efectivo esperado" value="•••••• oculto" />
                )}
              </div>

              {/* Conteo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Conteo por denominación</Label>
                  {denoms.length > 0 && !blindMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={autoFillExpected}
                      title="Rellena el conteo coincidiendo con el efectivo esperado"
                    >
                      <Wand2 className="w-3.5 h-3.5 mr-1" /> Cuadrar al esperado
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1 border rounded-lg p-2">
                  {denoms.map((d) => {
                    const q = parseInt(counts[d.id] || "0", 10) || 0;
                    const sub = q * Number(d.value);
                    const Icon = d.kind === "coin" ? Coins : Banknote;
                    return (
                      <div key={d.id} className="grid grid-cols-[1fr_80px_110px] items-center gap-2">
                        <span className="text-muted-foreground inline-flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{COP(Number(d.value))}</span>
                        </span>
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          className="h-9"
                          value={counts[d.id] ?? ""}
                          placeholder="0"
                          onChange={(e) => setCounts((c) => ({ ...c, [d.id]: e.target.value }))}
                        />
                        <span className="text-right tabular-nums">{COP(sub)}</span>
                      </div>
                    );
                  })}
                  {!denoms.length && (
                    <div className="text-muted-foreground text-xs p-2">No hay denominaciones configuradas.</div>
                  )}
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-3">
                <Row label="Efectivo contado" value={COP(countedTotal)} bold />
              </div>

              {/* Estado del cuadre — sólo si reveló o no es ciego */}
              {(!blindMode || revealed) && (
                <div className={`rounded-lg p-3 text-center font-bold border ${diffStyle}`}>
                  {diffLabel}
                  {!isSquare && (
                    <p className="text-[11px] font-normal mt-0.5 opacity-80">
                      Esperado {COP(expected)} · Contado {COP(countedTotal)}
                    </p>
                  )}
                </div>
              )}

              {/* Foto del arqueo */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" /> Foto del arqueo (opcional, recomendado)
                </Label>
                {photoPreview ? (
                  <div className="relative inline-block">
                    <img src={photoPreview} alt="Arqueo" className="h-32 rounded-md border object-cover" />
                    <button
                      type="button"
                      onClick={() => onPickPhoto(null)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                      aria-label="Quitar foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                    className="h-9 text-xs"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label>
                  Notas{(!blindMode || revealed) && !isSquare && <span className="text-destructive"> · obligatorias si hay descuadre</span>}
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={(!blindMode || revealed) && !isSquare ? "Explica el motivo del descuadre…" : "Opcional"}
                  aria-invalid={(!blindMode || revealed) && !isSquare && !notes.trim()}
                />
              </div>

              <Button className="w-full h-11" onClick={attemptClose} disabled={busy || uploading}>
                {busy || uploading ? "Cerrando..." : blindMode && !revealed ? "Revelar resultado y revisar" : "Cerrar caja"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cierre con descuadre</AlertDialogTitle>
            <AlertDialogDescription>
              Hay un {isShort ? "faltante" : "sobrante"} de <strong>{COP(diffAbs)}</strong> respecto al efectivo esperado ({COP(expected)}).
              Esta diferencia quedará registrada en la auditoría. ¿Confirmas el cierre?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Revisar conteo</AlertDialogCancel>
            <AlertDialogAction
              onClick={doClose}
              disabled={busy}
              className={isShort ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {busy ? "Cerrando..." : "Sí, cerrar caja"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}
