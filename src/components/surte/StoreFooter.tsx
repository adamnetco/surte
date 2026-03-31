import { useAppSettings } from "@/hooks/useStore";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";

const StoreFooter = () => {
  const { data: settings } = useAppSettings();
  const navigate = useNavigate();

  const storeName = settings?.store_name || "SURTÉ YA";
  const whatsapp = settings?.whatsapp_number || "";
  const email = settings?.footer_email || "";
  const address = settings?.footer_address || "";
  const nit = settings?.footer_nit || "";
  const legalText = settings?.footer_text || "";

  const navLinks = [
    { label: "Catálogo", path: "/catalogo" },
    { label: "Categorías", path: "/categorias" },
    { label: "Ofertas", path: "/ofertas" },
    { label: "Mis Pedidos", path: "/pedidos" },
    { label: "Ayuda", path: "/ayuda" },
  ];

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-2">{storeName}</h3>
            {nit && <p className="text-xs opacity-70 mb-3">NIT: {nit}</p>}
            <p className="text-sm opacity-80 leading-relaxed">
              Soluciones alimenticias para tu negocio. Pulpas, cárnicos, salsas y más.
            </p>
          </div>

          {/* Nav */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-3 opacity-90">Navegación</h4>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-sm opacity-70 hover:opacity-100 transition-opacity"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-3 opacity-90">Contacto</h4>
            <ul className="space-y-2.5">
              {whatsapp && (
                <li className="flex items-center gap-2 text-sm opacity-80">
                  <MessageCircle size={14} />
                  <a
                    href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-100 transition-opacity"
                  >
                    {whatsapp}
                  </a>
                </li>
              )}
              {email && (
                <li className="flex items-center gap-2 text-sm opacity-80">
                  <Mail size={14} />
                  <a href={`mailto:${email}`} className="hover:opacity-100 transition-opacity">
                    {email}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-2 text-sm opacity-80">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <span>{address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10 px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center">
          <p className="text-[11px] opacity-50">
            © {new Date().getFullYear()} {storeName}. Todos los derechos reservados.
          </p>
          {legalText && <p className="text-[11px] opacity-50">{legalText}</p>}
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
