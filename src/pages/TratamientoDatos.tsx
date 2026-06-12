import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import StoreFooter from "@/modules/storefront/components/StoreFooter";
import HeadMeta from "@/modules/marketing/seo/HeadMeta";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";
import { useTenantBranding, useTenantContact, useTenantLegal } from "@/modules/tenant";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

const TratamientoDatos = () => {
  const { legalName, name } = useTenantBranding();
  const { city, region, country, taxId, email } = useTenantContact();
  const { dataTreatmentHtml } = useTenantLegal();
  const storeName = legalName || name;
  const location = [city, region, country === "CO" ? "Colombia" : country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeadMeta title={`Tratamiento de Datos — ${storeName}`} description={`Política de tratamiento de datos personales de ${storeName}.`} />
      <TopBar />
      <main className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        <SeoBreadcrumbs items={[{ label: "Tratamiento de Datos" }]} className="mb-2" />
        <h1 className="text-xl font-heading font-bold text-foreground">Política de Tratamiento de Datos Personales</h1>

        {dataTreatmentHtml ? (
          <div className="text-sm text-muted-foreground leading-relaxed space-y-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(dataTreatmentHtml) }} />
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base font-heading font-semibold text-foreground">1. Responsable del Tratamiento</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {storeName}{taxId ? ` — NIT: ${taxId}` : ""}{location ? `, con domicilio en ${location}.` : "."} {email ? `Correo electrónico: ${email}` : ""}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-heading font-semibold text-foreground">2. Finalidad del Tratamiento</h2>
              <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
                <li>Gestionar y procesar pedidos y entregas.</li>
                <li>Comunicar promociones, ofertas y novedades por WhatsApp o correo electrónico.</li>
                <li>Mejorar nuestros servicios y experiencia de usuario.</li>
                <li>Cumplir con obligaciones legales y contables.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-heading font-semibold text-foreground">3. Derechos del Titular</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Como titular de los datos personales tienes derecho a conocer, actualizar, rectificar y solicitar la supresión de tus datos. Puedes ejercer estos derechos contactándonos a través de nuestros canales de atención.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-heading font-semibold text-foreground">4. Vigencia</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Los datos personales serán tratados durante el tiempo necesario para cumplir con las finalidades descritas y de acuerdo con la normativa vigente.
              </p>
            </section>
          </>
        )}
      </main>
      <StoreFooter />
      <BottomNav />
    </div>
  );
};

export default TratamientoDatos;
