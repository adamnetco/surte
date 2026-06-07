import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "already" | "error" | "success">("loading");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") setState("already");
        else if (data.valid) setState("valid");
        else setState("error");
      })
      .catch(() => setState("error"));
  }, [token]);

  const handleConfirm = async () => {
    setState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setState(data?.success ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 text-center" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        {state === "loading" && (
          <>
            <Loader2 size={40} className="animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Verificando...</p>
          </>
        )}
        {state === "valid" && (
          <>
            <MailX size={40} className="text-primary mx-auto mb-4" />
            <h1 className="text-xl font-heading font-bold text-foreground mb-2">Cancelar suscripción</h1>
            <p className="text-muted-foreground text-sm mb-6">
              ¿Deseas dejar de recibir correos de SURTÉ YA?
            </p>
            <button onClick={handleConfirm} className="w-full bg-primary text-primary-foreground font-heading font-semibold py-3 rounded-xl">
              Confirmar cancelación
            </button>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 size={40} className="text-surte-verde mx-auto mb-4" />
            <h1 className="text-xl font-heading font-bold text-foreground mb-2">¡Listo!</h1>
            <p className="text-muted-foreground text-sm">
              Has sido removido de nuestra lista de correos.
            </p>
          </>
        )}
        {state === "already" && (
          <>
            <CheckCircle2 size={40} className="text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-heading font-bold text-foreground mb-2">Ya cancelado</h1>
            <p className="text-muted-foreground text-sm">
              Tu suscripción ya fue cancelada anteriormente.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle size={40} className="text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-heading font-bold text-foreground mb-2">Enlace inválido</h1>
            <p className="text-muted-foreground text-sm">
              Este enlace de cancelación no es válido o ha expirado.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
