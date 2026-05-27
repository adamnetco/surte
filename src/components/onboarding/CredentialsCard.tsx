/**
 * CredentialsCard — pantalla final del wizard del superadmin con las
 * credenciales del nuevo dueño. Permite copiar y enviar por email/WhatsApp
 * usando fallbacks universales (mailto: / wa.me) — sin dependencia de
 * infraestructura adicional, funciona de inmediato.
 */
import { motion } from "framer-motion";
import { Copy, Mail, MessageCircle, PartyPopper, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface Props {
  storeName: string;
  slug: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  password: string | null;
  loginUrl: string;
  onCreateAnother: () => void;
  onGoToPanel?: () => void;
}

export function CredentialsCard({
  storeName,
  slug,
  ownerEmail,
  ownerPhone,
  password,
  loginUrl,
  onCreateAnother,
  onGoToPanel,
}: Props) {
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const message = [
    `Hola — tu tienda ${storeName} ya está activa en SistecPOS.`,
    ``,
    `Acceso: ${loginUrl}`,
    `Usuario: ${ownerEmail}`,
    password ? `Contraseña temporal: ${password}` : `Usa tu contraseña actual o "Olvidaste tu contraseña".`,
    ``,
    `Por seguridad, cámbiala al ingresar.`,
  ].join("\n");

  const mailto = `mailto:${encodeURIComponent(ownerEmail)}?subject=${encodeURIComponent(
    `Tu acceso a SistecPOS — ${storeName}`,
  )}&body=${encodeURIComponent(message)}`;

  const waNumber = (ownerPhone ?? "").replace(/\D/g, "");
  const wa = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="space-y-5"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-success/15 grid place-items-center">
          <PartyPopper className="h-6 w-6 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold">¡Tienda creada!</h2>
          <p className="text-sm text-muted-foreground">
            Comparte estas credenciales con el dueño. La contraseña no se mostrará otra vez.
          </p>
        </div>
      </div>

      <Card className="divide-y">
        <Row label="Tienda" value={storeName} onCopy={() => copy(storeName, "Nombre")} />
        <Row label="URL de acceso" value={loginUrl} onCopy={() => copy(loginUrl, "URL")} mono />
        <Row label="Usuario" value={ownerEmail} onCopy={() => copy(ownerEmail, "Usuario")} mono />
        {password ? (
          <Row label="Contraseña temporal" value={password} onCopy={() => copy(password, "Contraseña")} mono highlight />
        ) : (
          <div className="px-4 py-3 text-xs bg-muted/40">
            El usuario ya existía. Conserva su contraseña actual o pide reset desde el login.
          </div>
        )}
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" size="lg" className="gap-2 h-12">
          <a href={mailto}>
            <Mail className="h-4 w-4" /> Enviar por email
          </a>
        </Button>
        <Button
          asChild={!!wa}
          disabled={!wa}
          variant="outline"
          size="lg"
          className="gap-2 h-12"
          title={!wa ? "Sin WhatsApp del dueño" : undefined}
        >
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </a>
          ) : (
            <span>
              <MessageCircle className="h-4 w-4 mr-2 inline" /> WhatsApp
            </span>
          )}
        </Button>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full h-12 gap-2"
        onClick={() => copy(message, "Mensaje completo")}
        variant="secondary"
      >
        <Copy className="h-4 w-4" /> Copiar todo el mensaje
      </Button>

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Button variant="ghost" onClick={onCreateAnother} className="flex-1">
          Crear otra tienda
        </Button>
        {onGoToPanel ? (
          <Button onClick={onGoToPanel} className="flex-1 gap-2">
            Ir al panel <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

function Row({
  label, value, onCopy, mono, highlight,
}: { label: string; value: string; onCopy: () => void; mono?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${highlight ? "bg-primary/5" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-sm truncate ${mono ? "font-mono font-semibold" : "font-medium"}`}>{value}</div>
      </div>
      <Button size="icon" variant="ghost" onClick={onCopy} aria-label={`Copiar ${label}`}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
