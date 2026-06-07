import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Monitor, LogIn, Eye, EyeOff, Loader2, ShieldCheck, ShieldOff, Trash2, Zap, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SavedSession {
  id: string;
  pos_username: string;
  pos_store: string;
  pos_password: string;
  last_success_at: string;
}

export function ClientPOSAccess() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [store, setStore] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => { if (user) loadSavedSessions(); }, [user]);

  const loadSavedSessions = async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_client_pos_sessions", { _user_id: user.id });
      if (!error && data) setSavedSessions(data as SavedSession[]);
    } catch (err) {
      console.error("Error loading sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
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
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !store) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    if (consent) {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any).functions.invoke("validate-pos-login", {
          body: { username, password, store, consent: true },
        });
        if (error) throw error;
        submitPOSForm(username, store, password);
        if (data?.stored) toast({ title: "✅ Credenciales almacenadas correctamente" });
        else if (data?.success) toast({ title: "✅ Acceso verificado" });
        else toast({ title: "Abriendo POS...", description: data?.message });
        loadSavedSessions();
      } catch (err) {
        console.error("Validation error:", err);
        submitPOSForm(username, store, password);
        toast({ title: "Abriendo POS sin validación previa..." });
      } finally {
        setLoading(false);
      }
    } else {
      submitPOSForm(username, store, password);
      toast({ title: "Abriendo tu sistema POS..." });
    }
  };

  const handleQuickAccess = (session: SavedSession) => {
    submitPOSForm(session.pos_username, session.pos_store, session.pos_password);
    toast({ title: "Abriendo POS con acceso guardado..." });
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const { error } = await (supabase as any).from("client_pos_sessions").delete().eq("id", sessionId);
      if (error) throw error;
      setSavedSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast({ title: "Acceso eliminado correctamente" });
    } catch (err) {
      console.error("Delete error:", err);
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      {loadingSessions ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : savedSessions.length > 0 ? (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Acceso Rápido</CardTitle>
                <CardDescription>Ingresa al POS con tus credenciales verificadas.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedSessions.map((session) => (
              <div key={session.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
                <Button onClick={() => handleQuickAccess(session)} className="flex-1 justify-start gap-3" size="lg">
                  <LogIn className="h-4 w-4" />
                  <span className="flex-1 text-left">
                    <span className="font-semibold">{session.pos_store}</span>
                    <span className="text-primary-foreground/70 text-xs ml-2">({session.pos_username})</span>
                  </span>
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {formatDate(session.last_success_at)}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRevokeSession(session.id)} title="Eliminar acceso guardado">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-4">
            <ShieldOff className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              No tienes credenciales de POS almacenadas. Ingresa tus datos y autoriza el almacenamiento para tener acceso rápido en futuras visitas.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Acceder al Sistema POS</CardTitle>
              <CardDescription>Ingresa tus credenciales para abrir tu panel</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="pos-user">Usuario</Label>
              <Input id="pos-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <Label htmlFor="pos-store">Empresa</Label>
              <Input id="pos-store" value={store} onChange={(e) => setStore(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="pos-pass">Contraseña</Label>
              <div className="relative">
                <Input id="pos-pass" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="pr-10" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox id="consent" checked={consent} onCheckedChange={(c) => setConsent(c === true)} className="mt-0.5" />
                <label htmlFor="consent" className="text-sm leading-snug cursor-pointer">
                  <span className="font-medium">Autorizo almacenar mis credenciales de acceso</span>
                  <span className="text-muted-foreground block mt-0.5">
                    Tus datos se guardarán de forma encriptada para brindarte acceso rápido y soporte prioritario.
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-7">
                <Info className="h-3 w-3 shrink-0" />
                <span>Si no autorizas, podrás acceder al POS normalmente pero sin acceso rápido.</span>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando acceso…</>
                : <><LogIn className="mr-2 h-4 w-4" /> Ingresar al POS</>}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Se abrirá una nueva pestaña e ingresarás directamente a tu panel POS.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
