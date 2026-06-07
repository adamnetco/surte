import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mail, MessageCircle, ChevronDown, ChevronUp, FileText, Loader2 } from "lucide-react";
import type { POSCustomer } from "@/lib/posCustomer";
import { posCustomerSchema, type POSCustomerFormValues } from "@/lib/schemas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<POSCustomer>;
  /** Si la venta lleva factura electrónica DIAN, forzamos campos avanzados. */
  requireEinvoice?: boolean;
  onSave: (c: POSCustomer) => void;
}

const buildDefaults = (
  initial?: Partial<POSCustomer>,
  requireEinvoice?: boolean,
): POSCustomerFormValues => ({
  name: initial?.name ?? "",
  phone: initial?.phone ?? "",
  address: initial?.address ?? "",
  email: initial?.email ?? "",
  docType: (initial?.docType as POSCustomerFormValues["docType"]) ?? "CC",
  docNumber: initial?.docNumber ?? "",
  personType: (initial?.personType as POSCustomerFormValues["personType"]) ?? "natural",
  taxResponsibility: initial?.taxResponsibility ?? "No responsable de IVA",
  city: initial?.city ?? "",
  sendWhatsapp: initial?.sendWhatsapp ?? true,
  sendEmail: initial?.sendEmail ?? false,
  advanced: !!requireEinvoice,
  requireEinvoice: !!requireEinvoice,
});

/**
 * Diálogo "Cliente rápido" estilo VectorPOS, ahora con react-hook-form + zod.
 * - Modo express (3 datos): Nombre, Teléfono, Dirección.
 * - Modo avanzado (factura electrónica): Tipo doc, N° doc, Email, Razón social, Persona, Resp. tributaria.
 * - Toggles para enviar comprobante por WhatsApp / Email.
 */
export default function CustomerQuickDialog({ open, onOpenChange, initial, requireEinvoice, onSave }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<POSCustomerFormValues>({
    resolver: zodResolver(posCustomerSchema),
    defaultValues: buildDefaults(initial, requireEinvoice),
    mode: "onBlur",
  });

  // Reset cuando se abre el diálogo (o cambian inputs externos)
  useEffect(() => {
    if (open) reset(buildDefaults(initial, requireEinvoice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requireEinvoice, JSON.stringify(initial)]);

  const advanced = watch("advanced");
  const sendWhatsapp = watch("sendWhatsapp");
  const sendEmail = watch("sendEmail");
  const phone = watch("phone");
  const email = watch("email");

  const onSubmit = (values: POSCustomerFormValues) => {
    const cleaned: POSCustomer = {
      name: values.name.trim(),
      phone: values.phone?.trim() || undefined,
      address: values.address?.trim() || undefined,
      email: values.email?.trim() || undefined,
      docType: values.docType,
      docNumber: values.docNumber?.trim() || undefined,
      personType: values.personType,
      taxResponsibility: values.taxResponsibility || undefined,
      city: values.city?.trim() || undefined,
      sendWhatsapp: values.sendWhatsapp,
      sendEmail: values.sendEmail,
    };
    onSave(cleaned);
    onOpenChange(false);
  };

  const showAdvanced = advanced || requireEinvoice;

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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Nombre completo *" error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder="Ej. María García"
              autoFocus
              className="h-10"
              aria-invalid={!!errors.name}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono" error={errors.phone?.message}>
              <Input
                {...register("phone")}
                placeholder="3001234567"
                inputMode="tel"
                className="h-10"
                aria-invalid={!!errors.phone}
              />
            </Field>
            <Field label="Dirección" error={errors.address?.message}>
              <Input
                {...register("address")}
                placeholder="Cra 19 #39-19"
                className="h-10"
                aria-invalid={!!errors.address}
              />
            </Field>
          </div>

          {/* Envío de comprobante */}
          <div className="rounded-lg border p-3 space-y-2 bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground">Enviar comprobante</p>
            <ToggleRow
              icon={<MessageCircle className="w-4 h-4 text-[#25D366]" />}
              label="WhatsApp"
              hint={phone || "Requiere teléfono"}
              checked={!!sendWhatsapp}
              onChange={(v) => setValue("sendWhatsapp", v, { shouldValidate: true })}
            />
            <ToggleRow
              icon={<Mail className="w-4 h-4 text-primary" />}
              label="Correo electrónico"
              hint={email || "Requiere email"}
              checked={!!sendEmail}
              onChange={(v) => setValue("sendEmail", v, { shouldValidate: true })}
            />
          </div>

          {/* Toggle modo avanzado */}
          <button
            type="button"
            onClick={() => setValue("advanced", !advanced, { shouldValidate: true })}
            className="w-full flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1"
            disabled={!!requireEinvoice}
          >
            <span>Datos para factura electrónica</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-t pt-3 animate-fade-in">
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <Field label="Tipo doc">
                  <select
                    {...register("docType")}
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
                <Field label="Número de identificación *" error={errors.docNumber?.message}>
                  <Input
                    {...register("docNumber")}
                    placeholder="1098765432"
                    inputMode="numeric"
                    className="h-10"
                    aria-invalid={!!errors.docNumber}
                  />
                </Field>
              </div>
              <Field label="Email *" error={errors.email?.message}>
                <Input
                  {...register("email")}
                  placeholder="cliente@correo.com"
                  inputMode="email"
                  className="h-10"
                  aria-invalid={!!errors.email}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo persona">
                  <select
                    {...register("personType")}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="natural">Natural</option>
                    <option value="juridica">Jurídica</option>
                  </select>
                </Field>
                <Field label="Responsabilidad tributaria">
                  <select
                    {...register("taxResponsibility")}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option>No responsable de IVA</option>
                    <option>Responsable de IVA</option>
                    <option>Régimen simple</option>
                    <option>Gran contribuyente</option>
                  </select>
                </Field>
              </div>
              <Field label="Ciudad" error={errors.city?.message}>
                <Input {...register("city")} placeholder="Bucaramanga" className="h-10" aria-invalid={!!errors.city} />
              </Field>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-11 font-bold">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar y usar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive font-medium">{error}</p>}
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
