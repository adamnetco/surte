import { z } from "zod";

export const RECEIPT_CHANNELS = [
  "counter",
  "delivery",
  "platform",
  "table",
  "takeaway",
  "kitchen",
  "void",
] as const;
export type ReceiptChannel = (typeof RECEIPT_CHANNELS)[number];

export const CHANNEL_LABEL: Record<ReceiptChannel, string> = {
  counter: "Mostrador",
  delivery: "Domicilio",
  platform: "Plataforma",
  table: "Mesa",
  takeaway: "Para llevar",
  kitchen: "Comanda cocina",
  void: "Vale anulación",
};

export type SectionType =
  | "logo"
  | "store_info"
  | "order_meta"
  | "customer"
  | "items"
  | "totals"
  | "payments"
  | "qr"
  | "divider"
  | "text";

const baseSection = z.object({
  id: z.string().min(1),
  visible: z.boolean().default(true),
});

export const sectionSchema = z.discriminatedUnion("type", [
  baseSection.extend({ type: z.literal("logo"), align: z.enum(["left", "center", "right"]).default("center") }),
  baseSection.extend({
    type: z.literal("store_info"),
    fields: z.array(z.enum(["name", "nit", "address", "phone", "email"])).default(["name", "nit", "address", "phone"]),
  }),
  baseSection.extend({
    type: z.literal("order_meta"),
    fields: z.array(z.enum(["order_number", "date", "cashier", "register", "channel"])).default(["order_number", "date", "cashier"]),
  }),
  baseSection.extend({ type: z.literal("customer") }),
  baseSection.extend({
    type: z.literal("items"),
    columns: z.array(z.enum(["qty", "name", "unit", "total"])).default(["qty", "name", "total"]),
    showModifiers: z.boolean().default(true),
  }),
  baseSection.extend({
    type: z.literal("totals"),
    showTax: z.boolean().default(true),
    showTip: z.boolean().default(true),
    showDiscount: z.boolean().default(true),
  }),
  baseSection.extend({ type: z.literal("payments") }),
  baseSection.extend({
    type: z.literal("qr"),
    content: z.enum(["order_url", "invoice_cufe", "wompi_link"]).default("order_url"),
  }),
  baseSection.extend({
    type: z.literal("divider"),
    char: z.enum(["=", "-", ".", "*"]).default("-"),
  }),
  baseSection.extend({ type: z.literal("text"), value: z.string().default("") }),
]);

export type Section = z.infer<typeof sectionSchema>;

export const layoutSchema = z.object({
  sections: z.array(sectionSchema),
});
export type Layout = z.infer<typeof layoutSchema>;

export const SECTION_LABEL: Record<SectionType, string> = {
  logo: "Logo",
  store_info: "Datos de tienda",
  order_meta: "Encabezado de orden",
  customer: "Cliente",
  items: "Productos",
  totals: "Totales",
  payments: "Pagos",
  qr: "Código QR",
  divider: "Separador",
  text: "Texto libre",
};
