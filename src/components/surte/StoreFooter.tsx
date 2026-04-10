import { useAppSettings } from "@/hooks/useStore";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, MapPin, MessageCircle, ExternalLink, Star } from "lucide-react";

const SocialIcon = ({ type, url }: { type: string; url: string }) => {
  const icons: Record<string, string> = {
    facebook:
      "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    instagram:
      "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
    tiktok:
      "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  };
  const d = icons[type];
  if (!d) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d={d} />
      </svg>
    </a>
  );
};

const StoreFooter = () => {
  const { data: settings } = useAppSettings();
  const navigate = useNavigate();

  const storeName = settings?.store_name || "SURTÉ YA";
  const whatsapp = settings?.whatsapp_number || "";
  const email = settings?.footer_email || "";
  const address = settings?.footer_address || "";
  const nit = settings?.footer_nit || "";
  const legalText = settings?.footer_text || "";
  const googleMapsUrl = settings?.google_maps_url || "https://share.google/DK24P9JkD74z2iFaZ";
  const googleMapsEmbed = settings?.google_maps_embed || "";
  const facebook = settings?.social_facebook || "";
  const instagram = settings?.social_instagram || "";
  const tiktok = settings?.social_tiktok || "";
  const reviewMaps = "https://search.google.com/local/writereview";

  const navLinks = [
    { label: "Catálogo", path: "/catalogo" },
    { label: "Categorías", path: "/categorias" },
    { label: "Ofertas", path: "/ofertas" },
    { label: "Mis Pedidos", path: "/pedidos" },
    { label: "Ayuda", path: "/ayuda" },
  ];

  const legalLinks = [
    { label: "Políticas de Privacidad", path: "/politicas" },
    { label: "Tratamiento de Datos", path: "/tratamiento-datos" },
    { label: "Términos y Condiciones", path: "/politicas" },
  ];

  const hasSocial = facebook || instagram || tiktok;

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-heading font-bold text-lg mb-2">{storeName}</h3>
            {nit && <p className="text-xs opacity-70 mb-3">NIT: {nit}</p>}
            <p className="text-sm opacity-80 leading-relaxed">
              Soluciones alimenticias para tu negocio. Pulpas, cárnicos, salsas y más.
            </p>
            {hasSocial && (
              <div className="flex items-center gap-2 mt-4">
                {facebook && <SocialIcon type="facebook" url={facebook} />}
                {instagram && <SocialIcon type="instagram" url={instagram} />}
                {tiktok && <SocialIcon type="tiktok" url={tiktok} />}
              </div>
            )}
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

          {/* Legal */}
          <div>
            <h4 className="font-heading font-semibold text-sm mb-3 opacity-90">Legal</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
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

        {/* Google Maps */}
        <div className="mt-8 space-y-3">
          <h4 className="font-heading font-semibold text-sm opacity-90 text-center">📍 Encuéntranos</h4>
          {googleMapsEmbed ? (
            <div className="rounded-xl overflow-hidden border border-primary-foreground/10">
              <iframe
                src={googleMapsEmbed}
                width="100%"
                height="250"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Ubicación de ${storeName}`}
              />
            </div>
          ) : (
            <div className="bg-primary-foreground/5 rounded-xl p-6 text-center">
              <MapPin size={32} className="mx-auto mb-2 opacity-60" />
              <p className="text-sm opacity-70">Visítanos en Google Maps</p>
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors"
            >
              <ExternalLink size={14} /> Abrir en Google Maps
            </a>
            <a
              href={`${reviewMaps}?placeid=ChIJXSgYyOY_aI4RWV7JI63w5W8`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-accent text-accent-foreground rounded-xl px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Star size={14} /> Dejar Reseña
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center">
          <p className="text-[11px] opacity-50">
            © {new Date().getFullYear()} {storeName}. Todos los derechos reservados.
          </p>
          {legalText && <p className="text-[11px] opacity-50">{legalText}</p>}
          <p className="text-[11px] opacity-30">Powered by Conjuguémonos Grupo Empresarial</p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
