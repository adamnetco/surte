import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Download,
  GraduationCap,
  LifeBuoy,
  CreditCard,
} from "lucide-react";

/**
 * Placeholder del Portal de Clientes (Fase 1).
 * En Fase 2 se rellenan los tabs con los componentes migrados desde
 * `sistecpos-colombia/src/components/clientes/*`.
 */
export default function ClientPortalShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/user/login?redirect=/clientes" replace />;
  }

  const tabs = [
    { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
    { id: "subscription", label: "Suscripción", icon: CreditCard },
    { id: "billing", label: "Facturación", icon: Receipt },
    { id: "contracts", label: "Contratos", icon: FileText },
    { id: "downloads", label: "Descargas", icon: Download },
    { id: "trainings", label: "Entrenamientos", icon: GraduationCap },
    { id: "tickets", label: "Soporte", icon: LifeBuoy },
  ];

  return (
    <section className="py-8 md:py-12">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Portal de Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bienvenido, {user.user_metadata?.full_name || user.email}
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((t) => (
            <TabsContent key={t.id} value={t.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <t.icon className="h-5 w-5" />
                    {t.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Esta sección se migrará en la Fase 2 desde el repositorio{" "}
                    <code className="text-xs">sistecpos-colombia</code>.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
