import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCircle2, X, MessageCircle, Mail, Pencil, Search } from "lucide-react";
import { CONSUMIDOR_FINAL, isConsumidorFinal, type POSCustomer } from "@/modules/pos/lib/posCustomer";
import CustomerQuickDialog from "./CustomerQuickDialog";

interface Props {
  customer: POSCustomer | null;
  onChange: (c: POSCustomer | null) => void;
  /** True si el ticket actual emitirá factura electrónica DIAN. */
  requireEinvoice?: boolean;
  compact?: boolean;
}

/**
 * Chip de cliente para la barra superior del POS.
 * - Sin cliente → CTA naranja para asignar (rápido / consumidor final).
 * - Con cliente → muestra nombre + íconos de envío + editar/quitar.
 */
export default function POSCustomerPicker({ customer, onChange, requireEinvoice, compact }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popOpen, setPopOpen] = useState(false);

  const openCreate = () => { setPopOpen(false); setDialogOpen(true); };

  if (!customer) {
    return (
      <>
        <Popover open={popOpen} onOpenChange={setPopOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-9 w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-dashed border-accent/60 bg-accent/5 text-accent text-xs font-bold hover:bg-accent/15 transition px-3"
            >
              <UserPlus className="w-4 h-4" />
              {compact ? "Cliente" : "Asignar cliente"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2 space-y-1">
            <button
              type="button"
              onClick={openCreate}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
            >
              <Search className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Buscar o crear</p>
                <p className="text-[10px] text-muted-foreground">Nombre, doc., teléfono…</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { onChange(CONSUMIDOR_FINAL); setPopOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
            >
              <UserCircle2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Consumidor final</p>
                <p className="text-[10px] text-muted-foreground">Venta sin datos del cliente</p>
              </div>
            </button>
          </PopoverContent>
        </Popover>

        <CustomerQuickDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          requireEinvoice={requireEinvoice}
          onSave={(c) => onChange(c)}
        />
      </>
    );
  }

  const cf = isConsumidorFinal(customer);

  return (
    <>
      <div className="h-9 inline-flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/20 pr-1.5 pl-2.5 max-w-full">
        <UserCircle2 className={`w-4 h-4 shrink-0 ${cf ? "text-muted-foreground" : "text-primary"}`} />
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="text-xs font-bold truncate">{customer.name}</span>
          {!cf && (customer.phone || customer.email) && (
            <span className="text-[10px] text-muted-foreground truncate">
              {customer.phone || customer.email}
            </span>
          )}
        </div>

        {!cf && (
          <div className="flex items-center gap-0.5 ml-1">
            <ChannelDot active={!!customer.sendWhatsapp} title="WhatsApp" color="text-[#25D366]">
              <MessageCircle className="w-3 h-3" />
            </ChannelDot>
            <ChannelDot active={!!customer.sendEmail} title="Email" color="text-primary">
              <Mail className="w-3 h-3" />
            </ChannelDot>
          </div>
        )}

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="w-9 h-9 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Editar datos de ${customer.name}`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-9 h-9 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          aria-label={`Quitar cliente ${customer.name} del ticket`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <CustomerQuickDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requireEinvoice={requireEinvoice}
        initial={cf ? undefined : customer}
        onSave={(c) => onChange(c)}
      />
    </>
  );
}

function ChannelDot({
  active, color, title, children,
}: { active: boolean; color: string; title: string; children: React.ReactNode }) {
  return (
    <span
      title={`${title}: ${active ? "Activado" : "Desactivado"}`}
      className={`w-5 h-5 grid place-items-center rounded-full transition ${
        active ? `bg-background ${color} ring-1 ring-current` : "text-muted-foreground/40"
      }`}
    >
      {children}
    </span>
  );
}
