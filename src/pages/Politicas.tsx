import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import StoreFooter from "@/modules/storefront/components/StoreFooter";
import HeadMeta from "@/modules/marketing/seo/HeadMeta";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";
import { useTenantBranding, useTenantContact, useTenantLegal } from "@/modules/tenant";

const Politicas = () => {
  const { name: storeName } = useTenantBranding();
  const { city, region } = useTenantContact();
  const { privacyHtml, termsHtml } = useTenantLegal();
  const location = [city, region].filter(Boolean).join(", ") || "tu ciudad";

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeadMeta title={`Políticas — ${storeName}`} description={`Políticas de privacidad, devoluciones y envíos de ${storeName}.`} />
      <TopBar />
      <main className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        <SeoBreadcrumbs items={[{ label: "Políticas" }]} className="mb-2" />
        <h1 className="text-xl font-heading font-bold text-foreground">Políticas</h1>

        <section className="space-y-2">
          <h2 className="text-base font-heading font-semibold text-foreground">Política de Privacidad</h2>
          {privacyHtml ? (
            <div className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: privacyHtml }} />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              En {storeName} nos comprometemos a proteger tu información personal. Los datos recopilados (nombre, teléfono, dirección, correo electrónico) son utilizados exclusivamente para procesar tus pedidos y mejorar tu experiencia de compra. No compartimos tu información con terceros sin tu consentimiento.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-heading font-semibold text-foreground">Política de Devoluciones</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Aceptamos devoluciones dentro de las primeras 24 horas después de la entrega, siempre que el producto presente algún defecto de calidad o no corresponda a lo solicitado. Contáctanos por WhatsApp para gestionar tu devolución.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-heading font-semibold text-foreground">Política de Envíos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Realizamos entregas en {location} y su área de cobertura. Los tiempos de entrega varían según la zona. El costo de envío se calcula según el destino y se muestra antes de confirmar el pedido.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-heading font-semibold text-foreground">Términos y Condiciones</h2>
          {termsHtml ? (
            <div className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: termsHtml }} />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Al realizar un pedido en {storeName}, aceptas nuestros términos y condiciones. Nos reservamos el derecho de modificar precios y disponibilidad sin previo aviso. Todos los precios están expresados en Pesos Colombianos (COP) e incluyen impuestos aplicables.
            </p>
          )}
        </section>
      </main>
      <StoreFooter />
      <BottomNav />
    </div>
  );
};

export default Politicas;
