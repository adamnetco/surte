/**
 * ClientPOSAccess (nativo)
 *
 * Antes: el botón "Ingresar al POS" hacía form POST a
 *   https://softwarepos.online/index.php/login/index/1
 * (sistema PHP heredado de sistecpos.com). Eso quedó eliminado.
 *
 * Ahora: lleva al usuario al POS nativo (`/pos` → POSWorkspace)
 * dentro de SistecPOS Core, respetando organización activa y módulo
 * `pos`. Si falta configuración, ofrece atajo al onboarding.
 *
 * Documentado en mem://features/pos-native-login
 */
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, LogIn, Settings, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

export function ClientPOSAccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg, orgs, loading, hasModule, switchOrg } = useOrganization();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // Sin organización activa
  if (!currentOrg) {
    return (
      <Card className="max-w-lg border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Aún no tienes una tienda configurada</CardTitle>
              <CardDescription>
                Para entrar al POS primero crea tu tienda en el onboarding.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => navigate("/onboarding")}>
            <Sparkles className="mr-2 h-4 w-4" />
            Iniciar onboarding
          </Button>
        </CardContent>
      </Card>
    );
  }

  const posActivo = hasModule("pos");

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20 bg-primary/5 max-w-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                Tu POS nativo
                {posActivo ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>
                ) : (
                  <Badge variant="destructive">Módulo no activo</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Tienda: <span className="font-semibold">{currentOrg.name}</span>
                {currentOrg.slug ? <span className="text-muted-foreground"> · {currentOrg.slug}</span> : null}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {posActivo ? (
            <>
              <p className="text-sm text-muted-foreground">
                Abre la caja, vende, cobra e imprime tickets sin salir de SistecPOS Core.
                Tus datos quedan sincronizados en tiempo real.
              </p>
              <Button size="lg" className="w-full" onClick={() => navigate("/pos")}>
                <LogIn className="mr-2 h-4 w-4" />
                Entrar al POS
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => navigate("/pos/mesas")}>
                  Mesas
                </Button>
                <Button variant="outline" onClick={() => navigate("/pos/kds")}>
                  KDS / Cocina
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                El módulo <code className="bg-muted px-1 rounded">pos</code> no está activo
                para esta tienda. Configúralo desde el onboarding o pide a tu administrador que
                lo habilite.
              </p>
              <Button className="w-full" onClick={() => navigate(`/onboarding?org=${currentOrg.id}`)}>
                <Settings className="mr-2 h-4 w-4" />
                Configurar tienda
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Si el usuario tiene más de una tienda, permite cambiar */}
      {orgs.length > 1 && (
        <Card className="max-w-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cambiar de tienda</CardTitle>
            <CardDescription>Tienes acceso a varias organizaciones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => switchOrg(o.id)}
                className={`w-full text-left rounded-lg border p-3 transition ${
                  o.id === currentOrg.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <p className="text-sm font-semibold">{o.name}</p>
                <p className="text-xs text-muted-foreground">{o.slug}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {!user && (
        <p className="text-xs text-muted-foreground">
          Debes iniciar sesión para acceder al POS.
        </p>
      )}
    </div>
  );
}

export default ClientPOSAccess;
