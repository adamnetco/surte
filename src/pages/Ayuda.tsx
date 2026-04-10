import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { ArrowLeft, MessageCircle, Mail, Phone, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";
import { useState } from "react";
import { useAppSettings } from "@/hooks/useStore";

const faqs = [
  { q: "¿Cuál es el pedido mínimo?", a: "El pedido mínimo es de $40.000 COP y puede variar según configuración de la tienda." },
  { q: "¿Cuánto demora la entrega?", a: "Las entregas se realizan en 24-48 horas hábiles dentro de Bucaramanga y Área Metropolitana (Floridablanca, Girón, Piedecuesta)." },
  { q: "¿Cómo hago seguimiento de mi pedido?", a: "Ve a Menú → Mis Pedidos para ver el estado en tiempo real de tus órdenes." },
  { q: "¿Qué métodos de pago aceptan?", a: "Actualmente trabajamos con pago contra entrega (efectivo o transferencia). Pronto habilitaremos pagos en línea." },
  { q: "¿Puedo cancelar un pedido?", a: "Puedes cancelar tu pedido mientras esté en estado 'Pendiente'. Contáctanos por WhatsApp." },
  { q: "¿Hacen entregas fuera de Bucaramanga?", a: "Por ahora operamos en Bucaramanga y su Área Metropolitana (Floridablanca, Girón, Piedecuesta). Estamos en expansión." },
];

const Ayuda = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { data: settings } = useAppSettings();
  const whatsappNumber = settings?.whatsapp_number || "573000000000";

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <SeoBreadcrumbs items={[{ label: "Ayuda" }]} className="mb-2" />
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-heading font-bold text-foreground">Ayuda</h1>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-xl p-4 flex flex-col items-center gap-2 text-center"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <MessageCircle size={20} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-foreground">WhatsApp</span>
          </a>
          <a
            href="mailto:soporte@surte.co"
            className="bg-card rounded-xl p-4 flex flex-col items-center gap-2 text-center"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Mail size={20} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-foreground">Email</span>
          </a>
        </div>

        {/* FAQ */}
        <h2 className="font-heading font-bold text-base text-foreground mb-3">Preguntas Frecuentes</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium text-foreground pr-2">{faq.q}</span>
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Ayuda;