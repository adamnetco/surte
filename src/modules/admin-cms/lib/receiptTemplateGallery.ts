// Slice 5 — Galería de presets de plantillas (aplicables a cualquier canal).
// Cada preset describe layout + flags visuales. El nombre/canal NO se sobrescribe al aplicar.
import type { Layout } from "./receiptLayoutSchema";

export interface ReceiptPreset {
  id: string;
  name: string;
  description: string;
  paper_width_mm: 58 | 80;
  font_size_pt: number;
  show_logo: boolean;
  show_qr_pago: boolean;
  show_nit: boolean;
  header_text?: string | null;
  footer_text?: string | null;
  layout: Layout;
}

const baseSale: Layout = {
  sections: [
    { id: "logo", type: "logo", visible: true, align: "center" },
    { id: "store", type: "store_info", visible: true, fields: ["name", "nit", "address", "phone"] },
    { id: "d1", type: "divider", visible: true, char: "-" },
    { id: "meta", type: "order_meta", visible: true, fields: ["order_number", "date", "cashier"] },
    { id: "cust", type: "customer", visible: true },
    { id: "d2", type: "divider", visible: true, char: "-" },
    { id: "items", type: "items", visible: true, columns: ["qty", "name", "total"], showModifiers: true },
    { id: "d3", type: "divider", visible: true, char: "-" },
    { id: "tot", type: "totals", visible: true, showTax: true, showTip: true, showDiscount: true },
    { id: "pay", type: "payments", visible: true },
    { id: "qr", type: "qr", visible: true, content: "order_url" },
  ],
};

const kitchenLarge: Layout = {
  sections: [
    { id: "sh", type: "station_header", visible: true, fields: ["station", "table", "time"] },
    { id: "d1", type: "divider", visible: true, char: "=" },
    { id: "ki", type: "kitchen_items", visible: true, showModifiers: true, showNotes: true, bigFont: true },
    { id: "d2", type: "divider", visible: true, char: "-" },
    { id: "ft", type: "text", visible: true, value: "*** COCINA ***" },
  ],
};

const voidNotice: Layout = {
  sections: [
    { id: "logo", type: "logo", visible: false, align: "center" },
    { id: "title", type: "text", visible: true, value: "*** VALE DE ANULACIÓN ***" },
    { id: "meta", type: "order_meta", visible: true, fields: ["order_number", "date", "cashier"] },
    { id: "d1", type: "divider", visible: true, char: "=" },
    { id: "vn", type: "void_notice", visible: true, showReason: true, showFiscalHash: true },
    { id: "d2", type: "divider", visible: true, char: "-" },
    { id: "store", type: "store_info", visible: true, fields: ["name", "nit"] },
  ],
};

export const RECEIPT_PRESETS: ReceiptPreset[] = [
  {
    id: "compact-58",
    name: "Compacto 58mm",
    description: "Tickets cortos para impresoras de 58mm. Solo lo esencial.",
    paper_width_mm: 58,
    font_size_pt: 9,
    show_logo: false,
    show_qr_pago: false,
    show_nit: true,
    footer_text: "Gracias por su compra",
    layout: {
      sections: baseSale.sections.filter(
        (s) => !["logo", "qr", "cust"].includes(s.id),
      ),
    },
  },
  {
    id: "standard-80",
    name: "Estándar 80mm",
    description: "Diseño balanceado: logo, datos, items, totales y QR.",
    paper_width_mm: 80,
    font_size_pt: 11,
    show_logo: true,
    show_qr_pago: true,
    show_nit: true,
    footer_text: "¡Gracias por preferirnos!",
    layout: baseSale,
  },
  {
    id: "delivery-detailed",
    name: "Domicilio detallado",
    description: "Incluye cliente, dirección y QR de seguimiento del pedido.",
    paper_width_mm: 80,
    font_size_pt: 11,
    show_logo: true,
    show_qr_pago: true,
    show_nit: true,
    header_text: "DOMICILIO",
    footer_text: "Conserve este recibo",
    layout: baseSale,
  },
  {
    id: "kitchen-large",
    name: "Comanda cocina XL",
    description: "Texto grande, sin precios. Encabezado de estación y mesa.",
    paper_width_mm: 80,
    font_size_pt: 14,
    show_logo: false,
    show_qr_pago: false,
    show_nit: false,
    layout: kitchenLarge,
  },
  {
    id: "void-notice",
    name: "Vale de anulación",
    description: "Motivo de anulación + sello fiscal. Sin logo ni QR.",
    paper_width_mm: 80,
    font_size_pt: 11,
    show_logo: false,
    show_qr_pago: false,
    show_nit: true,
    layout: voidNotice,
  },
];
