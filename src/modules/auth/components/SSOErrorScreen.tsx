import { useEffect, useState } from "react";
import { AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SSOError } from "@/lib/ssoHandoff";

const MESSAGES: Record<SSOError, { title: string; body: string }> = {
  expired_or_used: {
    title: "El enlace de acceso expiró",
    body: "Por seguridad, los enlaces SSO entre módulos son de un solo uso y duran 60 segundos. Vuelve a iniciar sesión para continuar.",
  },
  issue_failed: {
    title: "No pudimos validar tu sesión",
    body: "El servidor rechazó la transferencia de sesión. Inicia sesión nuevamente.",
  },
  network: {
    title: "Sin conexión con el servidor",
    body: "Revisa tu internet e inténtalo de nuevo, o inicia sesión manualmente.",
  },
  no_session: {
    title: "Sesión requerida",
    body: "Necesitas iniciar sesión para acceder a este módulo.",
  },
};

/**
 * Pantalla bloqueante que aparece cuando un handoff SSO falló (nonce expirado,
 * ya usado, error de red, etc). Se monta sobre cualquier ruta y ofrece un CTA
 * único: ir a /login. Evita el "parpadeo de autenticación" porque se decide
 * ANTES de renderizar la app real.
 */
export default function SSOErrorScreen() {
  const [reason, setReason] = useState<SSOError | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__sso_error) {
      setReason(window.__sso_error);
      window.__sso_error = undefined;
    }
  }, []);

  if (!reason) return null;
  const m = MESSAGES[reason];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{m.title}</h2>
          <p className="text-sm text-muted-foreground">{m.body}</p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="w-full"
            onClick={() => { window.location.href = "/user/login"; }}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Iniciar sesión
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setReason(null)}
          >
            Continuar sin sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
