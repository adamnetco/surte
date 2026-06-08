import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, AlertTriangle, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLoginFlow } from "@/modules/auth/hooks/useLoginFlow";
import MethodPicker from "@/modules/auth/components/MethodPicker";
import PasskeyButton from "@/modules/auth/components/PasskeyButton";
import TotpInput from "@/modules/auth/components/TotpInput";
import RecoveryCodeInput from "@/modules/auth/components/RecoveryCodeInput";
import { useToast } from "@/hooks/use-toast";

/**
 * /superadmin/acceso — entrada segregada del staff de SistecPOS.
 *
 * UI completa (state machine + componentes). La verificación real se
 * conecta cuando Lovable Cloud responda y las edge functions auth-* +
 * la migración `auth-system.sql` estén desplegadas. Hasta entonces, este
 * panel sirve como prototipo navegable y para QA del flujo.
 */
const LoginSuperadmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const flow = useLoginFlow();
  const { state } = flow;

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    if (state.status === "idle") flow.start();
  }, [state.status, flow]);

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await flow.submitEmail(email);
  };

  const onVerify = (ok: boolean, message?: string) => {
    flow.reportVerifyResult(ok, message);
    if (ok) {
      toast({ title: "Acceso concedido" });
      navigate("/superadmin");
    } else if (message) {
      toast({ title: "Verificación fallida", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
            <ShieldCheck className="text-primary" />
          </div>
          <CardTitle className="text-xl">Acceso Staff SistecPOS</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ruta segregada para superadministradores y staff interno.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Backend en mantenimiento</AlertTitle>
            <AlertDescription className="text-xs">
              La verificación real (passkey + TOTP) se activa al desplegar las
              edge functions y la migración del sistema de acceso. Mientras
              tanto, la UI funciona en modo prototipo.
            </AlertDescription>
          </Alert>

          {(state.status === "idle" || state.status === "askEmail") && (
            <form onSubmit={onEmailSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="staff@sistecpos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {state.status === "askEmail" && state.error && (
                  <p className="text-xs text-destructive">{state.error}</p>
                )}
              </div>
              <Button type="submit" className="w-full h-11">
                Continuar
              </Button>
            </form>
          )}

          {state.status === "choosingMethod" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {state.email} — elige cómo verificar tu identidad
              </p>
              <PasskeyButton
                onTrigger={() => flow.chooseMethod("passkey")}
                label="Acceder con Passkey / FIDO2"
              />
              <MethodPicker
                factors={state.factors}
                onChoose={flow.chooseMethod}
                onRecovery={flow.useRecovery}
              />
              <Button variant="ghost" size="sm" onClick={flow.reset}>
                <ArrowLeft /> Cambiar email
              </Button>
            </div>
          )}

          {state.status === "verifying" && state.method === "password_totp" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Ingresa el código TOTP de tu app autenticadora
              </p>
              <TotpInput value={code} onChange={setCode} />
              <Button
                className="w-full"
                disabled={code.length !== 6}
                onClick={() => onVerify(false, "Backend no disponible (prototipo)")}
              >
                Verificar
              </Button>
              <Button variant="ghost" size="sm" onClick={flow.useRecovery}>
                ¿Perdiste el código? Usar recuperación
              </Button>
            </div>
          )}

          {state.status === "verifying" && state.method === "passkey" && (
            <div className="space-y-3 text-center">
              <KeyRound className="mx-auto text-primary" />
              <p className="text-sm">Aproxima tu llave o usa tu sensor biométrico…</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onVerify(false, "Backend no disponible (prototipo)")}
              >
                Cancelar
              </Button>
            </div>
          )}

          {state.status === "verifying" && state.method === "magic_link" && (
            <div className="space-y-3 text-center">
              <p className="text-sm">
                Te enviaremos un enlace mágico a <strong>{state.email}</strong>.
              </p>
              <Button onClick={() => onVerify(false, "Backend no disponible (prototipo)")}>
                Enviar enlace
              </Button>
            </div>
          )}

          {state.status === "verifying" && state.method === "google" && (
            <div className="space-y-3 text-center">
              <p className="text-sm">Redirigiendo a Google…</p>
              <Button variant="outline" onClick={flow.reset}>
                Cancelar
              </Button>
            </div>
          )}

          {state.status === "recovery" && (
            <div className="space-y-4">
              <RecoveryCodeInput value={recoveryCode} onChange={setRecoveryCode} />
              <Button
                className="w-full"
                disabled={recoveryCode.length < 10}
                onClick={() => onVerify(false, "Backend no disponible (prototipo)")}
              >
                Verificar código
              </Button>
              <Button variant="ghost" size="sm" onClick={flow.reset}>
                <ArrowLeft /> Volver
              </Button>
            </div>
          )}

          {state.status === "error" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Falló la verificación</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
              <Button size="sm" variant="outline" className="mt-3" onClick={flow.reset}>
                Reintentar
              </Button>
            </Alert>
          )}

          <div className="pt-2 border-t text-center">
            <Button variant="link" size="sm" onClick={() => navigate("/login")}>
              ¿No eres staff? Ir al login normal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginSuperadmin;
