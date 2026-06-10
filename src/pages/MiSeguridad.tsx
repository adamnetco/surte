import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, RefreshCw, Loader2, Copy } from "lucide-react";

interface EnrollResp { otpauth_uri: string; secret: string; }
interface CodesResp { codes: string[]; }

const MiSeguridad = () => {
  const [enroll, setEnroll] = useState<EnrollResp | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  const status = useQuery({
    queryKey: ["auth-security-status"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { totp: false, recovery: 0 };
      const [t, r] = await Promise.all([
        (supabase as any).from("auth_factors").select("id")
          .eq("user_id", u.user.id).eq("factor_type", "totp").not("verified_at", "is", null),
        (supabase as any).from("auth_recovery_codes").select("id")
          .eq("user_id", u.user.id).is("used_at", null),
      ]);
      return { totp: (t.data?.length ?? 0) > 0, recovery: r.data?.length ?? 0 };
    },
  });

  const startEnroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<EnrollResp>("auth-totp-enroll", { body: {} });
      if (error || !data) throw error ?? new Error("enroll_failed");
      return data;
    },
    onSuccess: (d) => setEnroll(d),
    onError: () => toast.error("No pudimos iniciar el enrolamiento"),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auth-totp-verify", { body: { code } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("2FA activado");
      setEnroll(null); setCode(""); status.refetch();
    },
    onError: () => toast.error("Código inválido"),
  });

  const genCodes = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<CodesResp>("auth-recovery-generate", { body: {} });
      if (error || !data) throw error ?? new Error("gen_failed");
      return data;
    },
    onSuccess: (d) => { setCodes(d.codes); status.refetch(); toast.success("Códigos generados"); },
    onError: () => toast.error("No pudimos generar códigos"),
  });

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copiado"); };

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="text-primary" />Mi seguridad</h1>
        <p className="text-sm text-muted-foreground">Gestiona segundo factor y códigos de recuperación.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><KeyRound size={20}/> Autenticación de dos pasos (TOTP)</span>
            <Badge variant={status.data?.totp ? "default" : "secondary"}>
              {status.data?.totp ? "Activo" : "Inactivo"}
            </Badge>
          </CardTitle>
          <CardDescription>Usa Google Authenticator, 1Password o Authy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enroll && (
            <Button onClick={() => startEnroll.mutate()} disabled={startEnroll.isPending}>
              {startEnroll.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
              {status.data?.totp ? "Re-enrolar" : "Activar 2FA"}
            </Button>
          )}
          {enroll && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <p className="text-sm">1. Escanea el QR o copia el secreto en tu app:</p>
              <div className="flex flex-col gap-2">
                <img
                  alt="QR TOTP"
                  className="w-44 h-44 bg-white p-2 rounded border"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enroll.otpauth_uri)}`}
                />
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded border break-all">{enroll.secret}</code>
                  <Button size="icon" variant="ghost" onClick={() => copy(enroll.secret)}><Copy size={14}/></Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>2. Ingresa el código de 6 dígitos</Label>
                <div className="flex gap-2">
                  <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
                  <Button onClick={() => verify.mutate()} disabled={code.length !== 6 || verify.isPending}>
                    {verify.isPending && <Loader2 className="animate-spin mr-2" size={16} />} Verificar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><RefreshCw size={20}/> Códigos de recuperación</span>
            <Badge variant={status.data?.recovery ? "default" : "secondary"}>
              {status.data?.recovery ?? 0} disponibles
            </Badge>
          </CardTitle>
          <CardDescription>Guárdalos en un lugar seguro. Cada código se usa una sola vez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => genCodes.mutate()} disabled={genCodes.isPending} variant="outline">
            {genCodes.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
            Generar nuevos códigos
          </Button>
          {codes && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {codes.map((c) => (
                <code key={c} className="text-sm bg-muted px-3 py-2 rounded font-mono">{c}</code>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MiSeguridad;
