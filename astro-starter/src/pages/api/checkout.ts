// POST /api/checkout
// Construye el mensaje WhatsApp (texto plano, sin emojis) y devuelve wa.me URL.
// Body: { items:[{name,quantity,price}], customer:{name,phone,address?,notes?}, totals?:{subtotal,delivery,total} }
import type { APIRoute } from "astro";
import { corsPreflight, errorResponse, jsonResponse, requireTenant, supaRest } from "../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n ?? 0);

export const POST: APIRoute = async ({ request }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;

  let body: any;
  try { body = await request.json(); } catch {
    return errorResponse(400, "INVALID_JSON", "Body must be JSON");
  }

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items?.length) return errorResponse(422, "VALIDATION_ERROR", "items[] required");
  const c = body?.customer ?? {};
  if (!c.name || !c.phone) return errorResponse(422, "VALIDATION_ERROR", "customer.name and customer.phone required");

  // Phone destino: tenant_settings.whatsapp_phone si existe, fallback a PUBLIC_WA_DEFAULT_PHONE
  let destination = import.meta.env.PUBLIC_WA_DEFAULT_PHONE ?? "";
  try {
    const rows = await supaRest<{ whatsapp_phone: string | null }[]>(
      `tenant_settings?organization_id=eq.${t.organization_id}&select=whatsapp_phone&limit=1`,
    );
    if (rows[0]?.whatsapp_phone) destination = rows[0].whatsapp_phone;
  } catch { /* ignore */ }

  const subtotal = body?.totals?.subtotal ?? items.reduce((s: number, i: any) => s + (i.price ?? 0) * (i.quantity ?? 1), 0);
  const delivery = body?.totals?.delivery ?? 0;
  const total = body?.totals?.total ?? subtotal + delivery;

  // Plain text, dashes/colons only — no emojis (WhatsApp encoding issues).
  const lines: string[] = [];
  lines.push(`Nuevo pedido - ${t.name}`);
  lines.push("");
  lines.push("Cliente:");
  lines.push(`- Nombre: ${c.name}`);
  lines.push(`- Telefono: ${c.phone}`);
  if (c.address) lines.push(`- Direccion: ${c.address}`);
  if (c.notes) lines.push(`- Notas: ${c.notes}`);
  lines.push("");
  lines.push("Productos:");
  for (const it of items) {
    lines.push(`- ${it.quantity ?? 1} x ${it.name} - ${formatCOP((it.price ?? 0) * (it.quantity ?? 1))}`);
  }
  lines.push("");
  lines.push(`Subtotal: ${formatCOP(subtotal)}`);
  if (delivery) lines.push(`Envio: ${formatCOP(delivery)}`);
  lines.push(`Total: ${formatCOP(total)}`);

  const text = lines.join("\n");
  const phoneDigits = (destination ?? "").replace(/[^\d]/g, "");
  const wa_url = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  return jsonResponse({ data: { wa_url, text, destination: phoneDigits || null } });
};
