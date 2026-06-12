// Plantillas HTML transaccionales tenant-aware.
// El branding (logo, colores, nombre, URL, dirección) llega vía `BrandConfig`.
// Cualquier valor vacío se omite o cae a un default neutro.

export interface BrandConfig {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  siteUrl?: string;
  catalogUrl?: string;
  addressLine?: string;
  primary?: string;
  secondary?: string;
  accent?: string;
  dark?: string;
  gray?: string;
  white?: string;
  fontFamily?: string;
  currency?: string;
}

const DEFAULT_BRAND: Required<BrandConfig> = {
  name: "",
  tagline: "",
  logoUrl: "",
  siteUrl: "",
  catalogUrl: "",
  addressLine: "",
  primary: "#0C4B83",
  secondary: "#76B833",
  accent: "#F37021",
  dark: "#032A46",
  gray: "#E6E6E6",
  white: "#FFFFFF",
  fontFamily: "'Montserrat', 'Inter', Arial, sans-serif",
  currency: "COP",
};

const resolveBrand = (b?: BrandConfig): Required<BrandConfig> => ({
  ...DEFAULT_BRAND,
  ...(b ?? {}),
});

const formatMoney = (n: number, currency: string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(n);

const baseLayout = (content: string, brand: Required<BrandConfig>) => {
  const catalogUrl = brand.catalogUrl || brand.siteUrl;
  const footerLink = brand.siteUrl
    ? `<a href="${brand.siteUrl}" style="color:${brand.primary};text-decoration:none;">${brand.siteUrl.replace(/^https?:\/\//, "")}</a>`
    : "";
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${brand.name || "Notificación"}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:${brand.fontFamily};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:${brand.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:${brand.primary};padding:24px 32px;text-align:center;">
            ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${brand.name}" style="max-height:48px;display:block;margin:0 auto 8px;"/>` : ""}
            ${brand.name ? `<h1 style="margin:0;color:${brand.white};font-size:22px;font-weight:700;letter-spacing:0.5px;">${brand.name}</h1>` : ""}
            ${brand.tagline ? `<p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">${brand.tagline}</p>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">${content}</td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid ${brand.gray};">
            <p style="margin:0;font-size:11px;color:#999;text-align:center;line-height:1.6;">
              © ${new Date().getFullYear()} ${brand.name || ""}<br/>
              ${brand.addressLine ? `${brand.addressLine}<br/>` : ""}
              ${footerLink}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderConfirmationData {
  orderNumber: number;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCost: number;
  couponDiscount?: number;
  couponCode?: string;
  total: number;
  trackingUrl: string;
  deliveryDate?: string;
  timeSlot?: string;
  paymentMethod?: string;
  address?: string;
  brand?: BrandConfig;
}

export function orderConfirmationTemplate(data: OrderConfirmationData): string {
  const brand = resolveBrand(data.brand);
  const fmt = (n: number) => formatMoney(n, brand.currency);
  const itemRows = data.items
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${i.quantity}x ${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right;white-space:nowrap;">${fmt(i.price * i.quantity)}</td>
    </tr>`
    )
    .join("");

  return baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${brand.secondary};color:white;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:22px;">✓</div>
    </div>
    <h2 style="margin:0 0 4px;font-size:20px;color:${brand.dark};text-align:center;">¡Pedido Confirmado!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#666;text-align:center;">Pedido <strong style="color:${brand.primary};">#${data.orderNumber}</strong></p>

    <p style="margin:0 0 16px;font-size:14px;color:#444;">Hola <strong>${data.customerName}</strong>, hemos recibido tu pedido. Aquí tienes el resumen:</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr style="background:#f9fafb;">
        <td style="padding:8px 0;font-size:11px;color:#999;font-weight:600;text-transform:uppercase;">Producto</td>
        <td style="padding:8px 0;font-size:11px;color:#999;font-weight:600;text-transform:uppercase;text-align:right;">Total</td>
      </tr>
      ${itemRows}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#666;">Subtotal</td>
        <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">${fmt(data.subtotal)}</td>
      </tr>
      ${data.couponDiscount && data.couponDiscount > 0 ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:${brand.secondary};">Cupón (${data.couponCode})</td>
        <td style="padding:4px 0;font-size:13px;color:${brand.secondary};text-align:right;">-${fmt(data.couponDiscount)}</td>
      </tr>` : ""}
      ${data.deliveryCost > 0 ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#666;">Domicilio</td>
        <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">${fmt(data.deliveryCost)}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:8px 0;font-size:16px;font-weight:700;color:${brand.dark};border-top:2px solid ${brand.primary};">Total</td>
        <td style="padding:8px 0;font-size:16px;font-weight:700;color:${brand.primary};text-align:right;border-top:2px solid ${brand.primary};">${fmt(data.total)}</td>
      </tr>
    </table>

    ${data.deliveryDate ? `<p style="margin:0 0 6px;font-size:13px;color:#555;">Entrega: <strong>${data.deliveryDate}</strong>${data.timeSlot ? ` (${data.timeSlot === "mañana" ? "8am-12pm" : "2pm-6pm"})` : ""}</p>` : ""}
    ${data.paymentMethod ? `<p style="margin:0 0 6px;font-size:13px;color:#555;">Pago: <strong>${data.paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}</strong></p>` : ""}
    ${data.address ? `<p style="margin:0 0 16px;font-size:13px;color:#555;">${data.address}</p>` : ""}

    <div style="text-align:center;margin-top:24px;">
      <a href="${data.trackingUrl}" style="display:inline-block;background:${brand.accent};color:white;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        Seguir mi Pedido
      </a>
    </div>
  `, brand);
}

export function welcomeTemplate(name: string, brand?: BrandConfig): string {
  const b = resolveBrand(brand);
  const catalogUrl = b.catalogUrl || b.siteUrl || "#";
  return baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${b.accent};color:white;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:22px;">👋</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:${b.dark};text-align:center;">¡Bienvenido${b.name ? ` a ${b.name}` : ""}!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#666;text-align:center;">Hola <strong>${name}</strong></p>

    <p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.6;">
      Gracias por unirte. Tu cuenta está activa y puedes empezar a explorar el catálogo.
    </p>

    <div style="text-align:center;margin-top:24px;">
      <a href="${catalogUrl}" style="display:inline-block;background:${b.accent};color:white;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        Ver Catálogo
      </a>
    </div>
  `, b);
}

export function passwordRecoveryTemplate(resetUrl: string, brand?: BrandConfig): string {
  const b = resolveBrand(brand);
  return baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${b.primary};color:white;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:22px;">🔒</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:${b.dark};text-align:center;">Recupera tu contraseña</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#666;text-align:center;">Recibimos una solicitud para restablecer tu contraseña.</p>

    <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
      Haz clic en el botón de abajo para crear una nueva contraseña. Este enlace expira en 1 hora.
    </p>

    <div style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:${b.accent};color:white;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        Restablecer Contraseña
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
      Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá siendo la misma.
    </p>
  `, b);
}

/** Helper para construir BrandConfig desde app_settings. */
export function brandFromSettings(s?: Record<string, string> | null): BrandConfig {
  if (!s) return {};
  return {
    name: s.store_name || s.seo_site_name,
    tagline: s.store_tagline,
    logoUrl: s.store_logo,
    siteUrl: s.site_url || (typeof window !== "undefined" ? window.location.origin : ""),
    catalogUrl: s.catalog_url,
    addressLine: s.footer_address,
    currency: s.currency_code,
  };
}
