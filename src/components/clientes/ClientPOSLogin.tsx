import { useState, useEffect, useRef } from "react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Monitor, LogIn, Download, HeadphonesIcon, Eye, EyeOff, ShieldCheck, Mail, Lock, KeyRound, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface SavedCredential {
  pos_username: string;
  pos_company: string;
  pos_password: string;
  business_name: string;
}

export function ClientPOSLogin() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [store, setStore] = useState("");
  const posCardRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [savedCreds, setSavedCreds] = useState<SavedCredential[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(false);

  const [supportEmail, setSupportEmail] = useState("");
  const [supportPassword, setSupportPassword] = useState("");
  const [showSupportPassword, setShowSupportPassword] = useState(false);
  const [supportView, setSupportView] = useState<"options" | "login" | "forgot">("options");
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    const email = searchParams.get("email");
    if (email) loadSavedCredentials(email);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("quick") === "demo") {
      setTimeout(() => posCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, [searchParams]);

  useEffect(() => {
    if (window.location.hash === "#pos") {
      setTimeout(() => posCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  }, []);

  const loadSavedCredentials = async (email: string) => {
    setLoadingCreds(true);
    try {
      const { data } = await (supabase as any)
        .from("leads_trials")
        .select("pos_username, pos_company, pos_password, business_name")
        .eq("email", email).not("pos_username", "is", null)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) setSavedCreds(data as SavedCredential[]);
    } catch (err) {
      console.error("Error loading credentials:", err);
    } finally {
      setLoadingCreds(false);
    }
  };

  const handlePOSLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !store) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    submitPOSForm(username, store, password);
  };

  const submitPOSForm = (user: string, company: string, pass: string) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://softwarepos.online/index.php/login/index/1";
    form.target = "_blank";
    const fields = { username: user, password: pass, store: company, remember_user: "1" };
    for (const [key, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden"; input.name = key; input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    toast({ title: "Abriendo tu sistema POS..." });
  };

  const handleQuickLogin = (cred: SavedCredential) =>
    submitPOSForm(cred.pos_username, cred.pos_company, cred.pos_password);

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/clientes`,
    });
    if (error) toast({ title: "Error al iniciar sesión con Google", variant: "destructive" });
  };

  const handleSupportLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportEmail || !supportPassword) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    setSupportLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: supportEmail, password: supportPassword,
      });
      if (error) {
        toast({ title: error.message.includes("Invalid login") ? "Credenciales incorrectas" : "Error al iniciar sesión", description: error.message, variant: "destructive" });
      }
    } finally {
      setSupportLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!supportEmail) { toast({ title: "Ingresa tu email primero", variant: "destructive" }); return; }
    setSupportLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(supportEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Correo enviado 📧", description: "Revisa tu bandeja de entrada." });
        setSupportView("options");
      }
    } finally {
      setSupportLoading(false);
    }
  };

  return (
    <section className="py-12 md:py-20">
      <div className="container px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center space-y-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">Acceso Clientes</h1>
            <p className="text-muted-foreground max-w-md mx-auto">Ingresa a tu sistema POS o accede al portal de soporte técnico</p>
          </div>

          {savedCreds.length > 0 && (
            <div className="mb-8 max-w-lg mx-auto">
              <Card className="border-2 border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" />
                    Acceso Rápido a tu Demo
                  </CardTitle>
                  <CardDescription>Haz clic para ingresar directamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {savedCreds.map((c, i) => (
                    <Button key={i} className="w-full justify-start gap-3" size="lg" onClick={() => handleQuickLogin(c)}>
                      <LogIn className="h-4 w-4" />
                      <span className="flex-1 text-left">
                        <span className="font-semibold">{c.business_name}</span>
                        <span className="text-primary-foreground/70 text-xs ml-2">({c.pos_username})</span>
                      </span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {loadingCreds && (
            <div className="mb-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          )}

          <div className="grid gap-8 md:grid-cols-2 items-start">
            <Card id="pos" ref={posCardRef} className="border-2 shadow-lg scroll-mt-20">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Monitor className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Ingresar al POS</CardTitle>
                    <CardDescription>Accede a tu sistema de facturación</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePOSLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Usuario</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="store">Tienda</Label>
                    <Input id="store" value={store} onChange={(e) => setStore(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Clave</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="pr-10" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" size="lg"><LogIn className="mr-2 h-4 w-4" />Ingresar al Sistema</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/50">
                    <HeadphonesIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Portal de Soporte</CardTitle>
                    <CardDescription>Tickets, entrenamientos y descargas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {supportView === "options" && (
                  <>
                    <p className="text-sm text-muted-foreground">Accede a soporte técnico, entrenamientos y descargas.</p>
                    <Button onClick={handleGoogleLogin} variant="outline" className="w-full gap-2" size="lg">
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Continuar con Google
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">o con email</span></div>
                    </div>
                    <Button variant="ghost" className="w-full gap-2" onClick={() => setSupportView("login")}>
                      <Mail className="h-4 w-4" />Ingresar con Email y Contraseña
                    </Button>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Acceso rápido</p>
                      <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                        <Link to="/ayuda"><Download className="h-4 w-4" />Ayuda y Descargas</Link>
                      </Button>
                    </div>
                  </>
                )}

                {supportView === "login" && (
                  <form onSubmit={handleSupportLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="support-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="support-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="pl-10" autoComplete="email" required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="support-password">Contraseña</Label>
                        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setSupportView("forgot")}>¿Olvidaste tu contraseña?</button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="support-password" type={showSupportPassword ? "text" : "password"} value={supportPassword} onChange={(e) => setSupportPassword(e.target.value)} className="pl-10 pr-10" autoComplete="current-password" required />
                        <button type="button" onClick={() => setShowSupportPassword(!showSupportPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                          {showSupportPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={supportLoading}>{supportLoading ? "Ingresando..." : "Ingresar al Soporte"}</Button>
                    <button type="button" className="w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setSupportView("options")}>← Volver a opciones</button>
                  </form>
                )}

                {supportView === "forgot" && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <KeyRound className="mx-auto h-10 w-10 text-primary mb-2" />
                      <p className="text-sm font-medium">Crear o restablecer contraseña</p>
                      <p className="text-xs text-muted-foreground mt-1">Te enviaremos un enlace a tu correo.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="forgot-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <Button onClick={handleForgotPassword} className="w-full" size="lg" disabled={supportLoading}>{supportLoading ? "Enviando..." : "Enviar Enlace"}</Button>
                    <button type="button" className="w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setSupportView("login")}>← Volver a iniciar sesión</button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ClientPOSLogin;
