import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
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
import { supabase } from "@/integrations/supabase/client";

const LoginSuperadmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const flow = useLoginFlow();
  const { state } = flow;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);

  useEffect(() => {
    if (state.status === "idle") flow.start();
  }, [state.status, flow]);

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await flow.submitEmail(email);
  };

  const success = () => {
    toast({ title: "Acceso concedido" });
    flow.reportVerifyResult(true);
    navigate("/superadmin");
  };

  const fail = (msg: string) => {
    flow.reportVerifyResult(false, msg);
    toast({ title: "Verificación fallida", description: msg, variant: "destructive" });
  };

  // ----- Password + TOTP -----
  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: state.status === "verifying" ? state.email : email, password });
      if (error) return fail(error.message);
      // Check if user has TOTP enrolled
      const { data: u } = await supabase.auth.getUser();
      const { data: factors } = await (supabase as any).from("auth_factors")
        .select("id").eq("user_id", u.user!.id).eq("factor_type", "totp").not("verified_at", "is", null).limit(1);
      if (factors?.length) {
        setNeedsTotp(true);
      } else {
        success();
      }
    } finally { setBusy(false); }
  };

  const onTotpSubmit = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("auth-totp-verify", { body: { code } });
      if (error) return fail("Código TOTP inválido");
      success();
    } finally { setBusy(false); }
  };

  // ----- Recovery -----
  const onRecoverySubmit = async () => {
    setBusy(true);
    try {
      // Recovery requires an active session (same as TOTP step). If user hasn't done password step first, ask.
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return fail("Primero ingresa contraseña, luego usa el código de recuperación");
      const { error } = await supabase.functions.invoke("auth-recovery-consume", { body: { code: recoveryCode } });
      if (error) return fail("Código de recuperación inválido");
      success();
    } finally { setBusy(false); }
  };

  // ----- Passkey -----
  const onPasskey = async () => {
    setBusy(true);
    try {
      const targetEmail = state.status === "verifying" || state.status === "choosingMethod" ? state.email : email;
      const { data, error } = await supabase.functions.invoke<{ options: any; challenge_token: string }>(
        "auth-webauthn-login-options",
        { body: { email: targetEmail } },
      );
      if (error || !data) return fail("No se pudo iniciar el desafío Passkey");
      const cred = await startAuthentication({ optionsJSON: data.options });
      const { data: v, error: vErr } = await supabase.functions.invoke<{ token_hash: string; email: string }>(
        "auth-webauthn-login-verify",
        { body: { email: targetEmail, credential: cred, challenge_token: data.challenge_token } },
      );
      if (vErr || !v?.token_hash) return fail("Passkey no verificada");
      const { error: otpErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: v.token_hash, email: v.email });
      if (otpErr) return fail(otpErr.message);
      success();
    } catch (e: any) {
      fail(e?.message ?? "Pasaste el desafío Passkey");
    } finally { setBusy(false); }
  };

  // ----- Magic link -----
  const onMagicLink = async () => {
    setBusy(true);
    try {
      const targetEmail = state.status === "verifying" ? state.email : email;
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { emailRedirectTo: `${window.location.origin}/superadmin` },
      });
      if (error) return fail(error.message);
      toast({ title: "Enlace enviado", description: "Revisa tu bandeja de entrada" });
    } finally { setBusy(false); }
  };

  // ----- Google -----
  const onGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/superadmin` },
    });
    if (error) {
      setBusy(false);
      fail(error.message);
    }
  };

  // Auto-trigger external flows when method chosen
  useEffect(() => {
    if (state.status === "verifying") {
      if (state.method === "passkey" && !busy) onPasskey();
      if (state.method === "google" && !busy) onGoogle();
      if (state.method === "magic_link" && !busy) onMagicLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, (state as any).method]);

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
          {(state.status === "idle" || state.status === "askEmail") && (
            <form onSubmit={onEmailSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email corporativo</Label>
                <Input id="email" type="email" required autoFocus
                  placeholder="staff@sistecpos.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                {state.status === "askEmail" && state.error && (
                  <p className="text-xs text-destructive">{state.error}</p>
                )}
              </div>
              <Button type="submit" className="w-full h-11">Continuar</Button>
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
              {!needsTotp ? (
                <form onSubmit={onPasswordSubmit} className="space-y-3">
                  <Label>Contraseña de {state.email}</Label>
                  <Input type="password" required autoFocus
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <Button type="submit" className="w-full" disabled={busy || password.length < 6}>
                    {busy && <Loader2 className="animate-spin mr-2" size={16} />} Continuar
                  </Button>
                </form>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    Ingresa el código TOTP de tu app autenticadora
                  </p>
                  <TotpInput value={code} onChange={setCode} />
                  <Button className="w-full" disabled={code.length !== 6 || busy} onClick={onTotpSubmit}>
                    {busy && <Loader2 className="animate-spin mr-2" size={16} />} Verificar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={flow.useRecovery}>
                    ¿Perdiste el código? Usar recuperación
                  </Button>
                </>
              )}
            </div>
          )}

          {state.status === "verifying" && state.method === "passkey" && (
            <div className="space-y-3 text-center">
              <KeyRound className="mx-auto text-primary" />
              <p className="text-sm">Aproxima tu llave o usa tu sensor biométrico…</p>
              {busy && <Loader2 className="animate-spin mx-auto" />}
              <Button variant="outline" size="sm" onClick={flow.reset}>Cancelar</Button>
            </div>
          )}

          {state.status === "verifying" && state.method === "magic_link" && (
            <div className="space-y-3 text-center">
              <p className="text-sm">
                Enviamos un enlace mágico a <strong>{state.email}</strong>. Revisa tu correo.
              </p>
              <Button variant="outline" onClick={flow.reset}>Volver</Button>
            </div>
          )}

          {state.status === "verifying" && state.method === "google" && (
            <div className="space-y-3 text-center">
              <p className="text-sm">Redirigiendo a Google…</p>
              <Loader2 className="animate-spin mx-auto" />
            </div>
          )}

          {state.status === "recovery" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {state.email} — ingresa un código de recuperación de un solo uso.
              </p>
              <RecoveryCodeInput value={recoveryCode} onChange={setRecoveryCode} />
              <Button className="w-full" disabled={recoveryCode.length < 10 || busy} onClick={onRecoverySubmit}>
                {busy && <Loader2 className="animate-spin mr-2" size={16} />} Verificar código
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
              <Button size="sm" variant="outline" className="mt-3" onClick={() => { flow.reset(); setNeedsTotp(false); setPassword(""); setCode(""); setRecoveryCode(""); }}>
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
