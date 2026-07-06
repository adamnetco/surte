/**
 * BuildWhatsAppPayload — Fuente única de verdad para el texto del pedido
 * enviado por WhatsApp.
 *
 * Consumidores: cliente React (Carrito.tsx), Astro API (`api/checkout.ts`),
 * y cualquier edge function que reformatee un pedido. Cualquier divergencia
 * de formato o cifras debe corregirse aquí.
 *
 * Reglas de memoria del proyecto (WhatsApp formatting):
 *  - Texto plano, sin emojis (evita encoding-issues en algunos clientes).
 *  - Guiones y dos puntos como separadores.
 *  - Números en formato COP (Intl.NumberFormat es-CO).
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */
import type { Cart } from "@/core/domain/entities/Cart";
import { computeTotals } from "@/core/use-cases/cart/ComputeTotals";
import type { Discount } from "@/core/domain/value-objects/Discount";

export interface WhatsAppCustomer {
  readonly name: string;
  readonly phone: string;
  readonly address?: string | null;
  readonly notes?: string | null;
}

export interface BuildWhatsAppPayloadInput {
  readonly tenantName: string;
  readonly cart: Cart;
  readonly customer: WhatsAppCustomer;
  readonly discount?: Discount;
  /** Costo de envío opcional (COP entero). */
  readonly deliveryCost?: number;
  /** Referencia opcional para enlazar el carrito omnicanal. */
  readonly cartToken?: string;
}

export interface WhatsAppPayload {
  readonly text: string;
  readonly totals: {
    readonly subtotal: number;
    readonly delivery: number;
    readonly total: number;
    readonly totalItems: number;
  };
}

const formatCOP = (n: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));

export const buildWhatsAppPayload = ({
  tenantName,
  cart,
  customer,
  discount,
  deliveryCost = 0,
  cartToken,
}: BuildWhatsAppPayloadInput): WhatsAppPayload => {
  const totals = computeTotals({ cart, discount });
  const subtotal = totals.total.amount; // ya con descuento aplicado
  const total = subtotal + deliveryCost;

  const lines: string[] = [];
  lines.push(`Nuevo pedido - ${tenantName}`);
  lines.push("");
  lines.push("Cliente:");
  lines.push(`- Nombre: ${customer.name}`);
  lines.push(`- Telefono: ${customer.phone}`);
  if (customer.address) lines.push(`- Direccion: ${customer.address}`);
  if (customer.notes) lines.push(`- Notas: ${customer.notes}`);
  lines.push("");
  lines.push("Productos:");
  for (const l of cart.lines) {
    lines.push(
      `- ${l.quantity} x ${l.name} - ${formatCOP(l.unitPrice * l.quantity)}`,
    );
  }
  lines.push("");
  if (totals.discount.amount > 0) {
    lines.push(`Descuento: -${formatCOP(totals.discount.amount)}`);
  }
  lines.push(`Subtotal: ${formatCOP(subtotal)}`);
  if (deliveryCost > 0) lines.push(`Envio: ${formatCOP(deliveryCost)}`);
  lines.push(`Total: ${formatCOP(total)}`);
  if (cartToken) {
    lines.push("");
    lines.push(`CART:${cartToken}`);
  }

  return {
    text: lines.join("\n"),
    totals: {
      subtotal,
      delivery: deliveryCost,
      total,
      totalItems: totals.totalItems,
    },
  };
};
