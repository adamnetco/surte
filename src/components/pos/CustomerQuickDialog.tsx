import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mail, MessageCircle, ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { POSCustomer } from "@/lib/posCustomer";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<POSCustomer>;
  /** Si la venta lleva factura electrónica DIAN, forzamos campos avanzados. */
  requireEinvoice?: boolean;
  onSave: (c: POSCustomer) => void;
}

/**
 * Diálogo "Cliente rápido" estilo VectorPOS:
 * - Modo express (3 datos): Nombre, Teléfono, Dirección.
 * - Modo avanzado (factura electrónica): Tipo doc, N° doc, Email, Razón social, Persona, Resp. tributaria.
 * - Toggles para enviar comprobante por WhatsApp / Email.
 */
export default function CustomerQuickDialog({ open, onOpenChange, initial, requireEinvoice, onSave }: Props) {
  const [advanced, setAdvanced] = useState(!!requireEinvoice);
  const [form, setForm] = useState<POSCustomer>({
    name: "",
    phone: "",
    address: "",
    email: "",
    docType: "CC",
    docNumber: "",
    personType: "natural",
    taxResponsibility: "No responsable de IVA",
    sendWhatsapp: true,
    sendEmail: false,
    ...initial,
  });

  useEffect(() => {
    if (open) {
      setAdvanced(!!requireEinvoice);
      setForm((p) => ({ ...p, ...initial }));
    }
  }, [open, requireEinvoice, initial]);

  const set = <K extends keyof POSCustomer>(k: K, v: POSCustomer[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const validate = (): string | null => {
    if (!form.name?.trim()) return "El nombre es obligatorio";
    if (form.name.trim().length > 80) return "Nombre demasiado largo";
    if (form.phone && !/^[\d +()-]{6,20}$/.test(form.phone)) return "Teléfono inválido";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return "Email inválido";
    if (advanced || requireEinvoice) {
      if (!form.docNumber?.trim()) return "El número de identificación es obligatorio para factura electrónica";
      if (!form.email?.trim()) return "El email es obligatorio para factura electrónica";
    }
    if (form.sendWhatsapp && !form.phone) return "Para enviar por WhatsApp, ingresa el teléfono";
    if (form.sendEmail && !form.email) return "Para enviar por Email, ingresa el correo";
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    onSave({
      ...form,
      name: form.name.trim(),
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() || undefined,
      email: form.email?.trim() || undefined,
      docNumber: form.docNumber?.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Cliente del ticket
          </DialogTitle>
          <DialogDescription>
            Datos mínimos para entregar el pedido. Activa el modo avanzado solo si emites factura electrónica.
          </DialogDescription>
        </DialogHeader>

        {/* === Campos rápidos === */}
        <div className="space-y-3">
          <Field label="Nombre completo *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. María García" autoFocus className="h-10" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="3001234567" inputMode="tel" className="h-10" />
            </Field>
            <Field label="Dirección">
              <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Cra 19 #39-19" className="h-10" />
            </Field>
          </div>

          {/* Envío de comprobante */}
          <div className="rounded-lg border p-3 space-y-2 bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground">Enviar comprobante</p>
            <ToggleRow
              icon={<MessageCircle className="w-4 h-4 text-[#25D366]" />}
              label="WhatsApp"
              hint={form.phone || "Requiere teléfono"}
              checked={!!form.sendWhatsapp}
              onChange={(v) => set("sendWhatsapp", v)}
            />
            <ToggleRow
              icon={<Mail className="w-4 h-4 text-primary" />}
              label="Correo electrónico"
              hint={form.email || "Requiere email"}
              checked={!!form.sendEmail}
              onChange={(v) => set("sendEmail", v)}
            />
          </div>

          {/* Toggle modo avanzado */}
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1"
          >
            <span>Datos para factura electrónica</span>
            {advanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {advanced && (
            <div className="space-y-3 border-t pt-3 animate-fade-in">
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <Field label="Tipo doc">
                  <select
                    value={form.docType}
                    onChange={(e) => set("docType", e.target.value as POSCustomer["docType"])}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="CC">CC</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">CE</option>
                    <option value="PAS">PAS</option>
                    <option value="TI">TI</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </Field>
                <Field label="Número de identificación *">
                  <Input value={form.docNumber ?? ""} onChange={(e) => set("docNumber", e.target.value)} placeholder="1098765432" inputMode="numeric" className="h-10" />
                </Field>
              </div>
              <Field label="Email *">
                <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="cliente@correo.com" inputMode="email" className="h-10" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo persona">
                  <select
                    value={form.personType}
                    onChange={(e) => set("personType", e.target.value as POSCustomer["personType"])}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="natural">Natural</option>
                    <option value="juridica">Jurídica</option>
                  </select>
                </Field>
                <Field label="Responsabilidad tributaria">
                  <select
                    value={form.taxResponsibility}
                    onChange={(e) => set("taxResponsibility", e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option>No responsable de IVA</option>
                    <option>Responsable de IVA</option>
                    <option>Régimen simple</option>
                    <option>Gran contribuyente</option>
                  </select>
                </Field>
              </div>
              <Field label="Ciudad">
                <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Bucaramanga" className="h-10" />
              </Field>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="flex-1 h-11 font-bold" onClick={handleSave}>Guardar y usar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  icon, label, hint, checked, onChange,
}: { icon: React.ReactNode; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
