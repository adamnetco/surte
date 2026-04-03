import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import StoreFooter from "@/components/surte/StoreFooter";
import HeadMeta from "@/components/seo/HeadMeta";
import { useAppSettings } from "@/hooks/useStore";

const TratamientoDatos = () => {
  const { data: settings } = useAppSettings();
  const storeName = settings?.store_name || "SURTÉ YA";
  const nit = settings?.footer_nit || "";
  const email = settings?.footer_email || "";

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeadMeta title={`Tratamiento de Datos — ${storeName}`} description={`Política de tratamiento de datos personales de ${storeName}.`} />
      <TopBar />
      <main className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-heading font-bold text-foreground">Política de Tratamiento de Datos Personales</h1>

        <section className="space-y-2">
          <h2 className="text-base font-heading font-semibold text-foreground">1. Responsable del Tratamiento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {storeName}{nit ? ` — NIT: ${nit}` : ""}, con domicilio en Bucaramanga, Santander, Colombia. {email ? `Correo electrónico: ${email}` : ""}
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
            De acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013, como titular de los datos personales tienes derecho a: conocer, actualizar, rectificar y solicitar la supresión de tus datos personales. Puedes ejercer estos derechos contactándonos a través de nuestros canales de atención.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-heading font-semibold text-foreground">4. Vigencia</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los datos personales serán tratados durante el tiempo necesario para cumplir con las finalidades descritas y de acuerdo con la normativa colombiana vigente.
          </p>
        </section>
      </main>
      <StoreFooter />
      <BottomNav />
    </div>
  );
};

export default TratamientoDatos;
