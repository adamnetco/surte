// Branded HTML email templates for SURTÉ YA
const LOGO_URL = "https://surteya.com/favicon.svg";
const BRAND = {
  primary: "#0C4B83",
  secondary: "#76B833",
  accent: "#F37021",
  dark: "#032A46",
  gray: "#E6E6E6",
  white: "#FFFFFF",
  fontFamily: "'Montserrat', 'Inter', Arial, sans-serif",
};

const baseLayout = (content: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SURTÉ YA</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:${BRAND.fontFamily};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND.primary};padding:24px 32px;text-align:center;">
            <h1 style="margin:0;color:${BRAND.white};font-size:22px;font-weight:700;letter-spacing:0.5px;">SURTÉ YA</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Soluciones Alimenticias</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid ${BRAND.gray};">
            <p style="margin:0;font-size:11px;color:#999;text-align:center;line-height:1.6;">
              © ${new Date().getFullYear()} SURTÉ YA — Conjuguémonos Grupo Empresarial<br/>
              Bucaramanga, Santander, Colombia<br/>
              <a href="https://surteya.com" style="color:${BRAND.primary};text-decoration:none;">surteya.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

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
}

export function orderConfirmationTemplate(data: OrderConfirmationData): string {
  const itemRows = data.items
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${i.quantity}x ${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right;white-space:nowrap;">${formatCOP(i.price * i.quantity)}</td>
    </tr>`
    )
    .join("");

  return baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${BRAND.secondary};color:white;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:22px;">✓</div>
    </div>
    <h2 style="margin:0 0 4px;font-size:20px;color:${BRAND.dark};text-align:center;">¡Pedido Confirmado!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#666;text-align:center;">Pedido <strong style="color:${BRAND.primary};">#${data.orderNumber}</strong></p>

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
        <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">${formatCOP(data.subtotal)}</td>
      </tr>
      ${data.couponDiscount && data.couponDiscount > 0 ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:${BRAND.secondary};">🎟️ Cupón (${data.couponCode})</td>
        <td style="padding:4px 0;font-size:13px;color:${BRAND.secondary};text-align:right;">-${formatCOP(data.couponDiscount)}</td>
      </tr>` : ""}
      ${data.deliveryCost > 0 ? `
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#666;">🚚 Domicilio</td>
        <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">${formatCOP(data.deliveryCost)}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:8px 0;font-size:16px;font-weight:700;color:${BRAND.dark};border-top:2px solid ${BRAND.primary};">Total</td>
        <td style="padding:8px 0;font-size:16px;font-weight:700;color:${BRAND.primary};text-align:right;border-top:2px solid ${BRAND.primary};">${formatCOP(data.total)}</td>
      </tr>
    </table>

    ${data.deliveryDate ? `<p style="margin:0 0 6px;font-size:13px;color:#555;">📅 Entrega: <strong>${data.deliveryDate}</strong>${data.timeSlot ? ` (${data.timeSlot === "mañana" ? "8am-12pm" : "2pm-6pm"})` : ""}</p>` : ""}
    ${data.paymentMethod ? `<p style="margin:0 0 6px;font-size:13px;color:#555;">💳 Pago: <strong>${data.paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}</strong></p>` : ""}
    ${data.address ? `<p style="margin:0 0 16px;font-size:13px;color:#555;">📍 ${data.address}</p>` : ""}

    <div style="text-align:center;margin-top:24px;">
      <a href="${data.trackingUrl}" style="display:inline-block;background:${BRAND.accent};color:white;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        📦 Seguir mi Pedido
      </a>
    </div>
  `);
}

export function welcomeTemplate(name: string): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${BRAND.accent};color:white;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:22px;">👋</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND.dark};text-align:center;">¡Bienvenido a SURTÉ YA!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#666;text-align:center;">Hola <strong>${name}</strong></p>

    <p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.6;">
      Gracias por unirte a nuestra plataforma de soluciones alimenticias. Ahora puedes acceder a:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:10px 12px;background:#f0f7ff;border-radius:8px;margin-bottom:8px;">
          <p style="margin:0;font-size:13px;color:${BRAND.primary};font-weight:600;">🛒 Catálogo completo</p>
          <p style="margin:2px 0 0;font-size:12px;color:#666;">Pulpas, cárnicos, salsas y más</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:10px 12px;background:#f5fbf0;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:${BRAND.secondary};font-weight:600;">💰 Precios especiales</p>
          <p style="margin:2px 0 0;font-size:12px;color:#666;">Descuentos para HORECA y minimercados</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:10px 12px;background:#fff8f3;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:${BRAND.accent};font-weight:600;">🚚 Entrega rápida</p>
          <p style="margin:2px 0 0;font-size:12px;color:#666;">Servicio en Bucaramanga y alrededores</p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin-top:24px;">
      <a href="https://surteya.com/catalogo" style="display:inline-block;background:${BRAND.accent};color:white;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        Ver Catálogo
      </a>
    </div>
  `);
}

export function passwordRecoveryTemplate(resetUrl: string): string {
  return baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${BRAND.primary};color:white;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:22px;">🔒</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND.dark};text-align:center;">Recupera tu contraseña</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#666;text-align:center;">Recibimos una solicitud para restablecer tu contraseña.</p>

    <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
      Haz clic en el botón de abajo para crear una nueva contraseña. Este enlace expira en 1 hora.
    </p>

    <div style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:${BRAND.accent};color:white;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        Restablecer Contraseña
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
      Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá siendo la misma.
    </p>
  `);
}
