/**
 * Schemas zod centralizados para formularios admin.
 * Mensajes en español, listos para usar con react-hook-form (zodResolver).
 */
import { z } from "zod";

/* ============================================================
 * Helpers reutilizables
 * ============================================================ */

const slugRule = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(80, "Máximo 80 caracteres")
  .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones")
  .refine((v) => !v.startsWith("-") && !v.endsWith("-"), "No puede empezar ni terminar en guión");

/** Permite cadenas vacías → undefined antes de parsear como número. */
const optionalNumber = (max = 1_000_000_000) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ invalid_type_error: "Debe ser un número" })
      .min(0, "No puede ser negativo")
      .max(max, "Valor demasiado alto")
      .optional()
  );

const requiredNumber = (max = 1_000_000_000) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ invalid_type_error: "Obligatorio", required_error: "Obligatorio" })
      .min(0, "No puede ser negativo")
      .max(max, "Valor demasiado alto")
  );

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}){1,2}$/, "Color hex inválido (#RRGGBB)")
  .optional()
  .or(z.literal(""));

const urlOptional = z
  .string()
  .trim()
  .url("URL inválida")
  .max(500, "URL demasiado larga")
  .optional()
  .or(z.literal(""));

/* ============================================================
 * Category
 * ============================================================ */

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  slug: slugRule,
  icon: z.string().trim().min(1, "Selecciona un icono").max(500),
  sort_order: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z.number().int("Debe ser entero").min(0, "No puede ser negativo").max(9999, "Máximo 9999")
  ),
  color: hexColor,
  meta_title: z.string().trim().max(60, "Máximo 60 caracteres (recomendado SEO)").optional().or(z.literal("")),
  meta_description: z
    .string()
    .trim()
    .max(160, "Máximo 160 caracteres (recomendado SEO)")
    .optional()
    .or(z.literal("")),
  og_image_url: urlOptional,
});
export type CategoryFormValues = z.infer<typeof categorySchema>;

/* ============================================================
 * Organization
 * ============================================================ */

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(100, "Máximo 100 caracteres"),
  slug: slugRule,
  business_type: z.enum(["retail", "restaurant", "salon", "service", "wholesale"], {
    errorMap: () => ({ message: "Selecciona un tipo válido" }),
  }),
  country: z.string().length(2, "Código de país inválido"),
  currency: z.string().length(3, "Código de moneda inválido"),
});
export type OrganizationFormValues = z.infer<typeof organizationSchema>;

/* ============================================================
 * Product
 * - Acepta los datos crudos del formulario (strings de inputs).
 * - Tras parsear, los precios/stock son números, las listas son arrays, etc.
 * ============================================================ */

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Mínimo 2 caracteres").max(150, "Máximo 150 caracteres"),
    slug: z
      .string()
      .trim()
      .max(150, "Máximo 150 caracteres")
      .regex(/^[a-z0-9-]*$/, "Solo minúsculas, números y guiones")
      .optional()
      .or(z.literal("")),
    description: z.string().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
    price: requiredNumber(99_999_999),
    original_price: optionalNumber(99_999_999),
    price_wholesale: optionalNumber(99_999_999),
    price_distributor: optionalNumber(99_999_999),
    cost_price: optionalNumber(99_999_999),
    stock: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
      z.number().int("Debe ser entero").min(0, "No puede ser negativo").max(1_000_000, "Stock demasiado alto")
    ),
    unit: z.string().max(20).optional().or(z.literal("")),
    category_id: z.string().uuid("Categoría inválida").optional().or(z.literal("")),
    brand: z.string().max(80).optional().or(z.literal("")),
    sku: z.string().max(50).optional().or(z.literal("")),
    gtin: z
      .string()
      .max(20)
      .regex(/^\d*$/, "Solo dígitos")
      .optional()
      .or(z.literal("")),
    meta_title: z.string().max(60, "Máximo 60 caracteres").optional().or(z.literal("")),
    meta_description: z.string().max(160, "Máximo 160 caracteres").optional().or(z.literal("")),
    image_url: urlOptional,
    unit_quantity: optionalNumber(999_999),
    net_weight_grams: optionalNumber(999_999),
    is_active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Reglas cruzadas: precios mayoristas deben ser ≤ precio detal.
    if (data.price_wholesale != null && data.price_wholesale > data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price_wholesale"],
        message: "El precio mayorista no puede superar el detal",
      });
    }
    if (data.price_distributor != null && data.price_distributor > data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price_distributor"],
        message: "El precio distribuidor no puede superar el detal",
      });
    }
    // El precio "antes" (tachado) debe ser mayor al precio actual.
    if (data.original_price != null && data.original_price <= data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["original_price"],
        message: "El precio antes debe ser mayor que el precio actual",
      });
    }
    // El costo no puede superar el precio (margen negativo es bug habitual).
    if (data.cost_price != null && data.cost_price > data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cost_price"],
        message: "El costo es mayor al precio: margen negativo",
      });
    }
  });

export type ProductFormValues = z.infer<typeof productSchema>;

/* ============================================================
 * Brand
 * ============================================================ */

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  slug: slugRule,
  logo_url: urlOptional,
  website_url: urlOptional,
  sort_order: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z.number().int("Debe ser entero").min(0, "No puede ser negativo").max(9999, "Máximo 9999")
  ),
  is_active: z.boolean(),
  meta_title: z.string().trim().max(60, "Máximo 60 caracteres (recomendado SEO)").optional().or(z.literal("")),
  meta_description: z.string().trim().max(160, "Máximo 160 caracteres (recomendado SEO)").optional().or(z.literal("")),
  og_image_url: urlOptional,
});
export type BrandFormValues = z.infer<typeof brandSchema>;

/* ============================================================
 * Hero slide
 * ============================================================ */

export const heroSlideSchema = z.object({
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(120, "Máximo 120 caracteres"),
  subtitle: z.string().trim().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  image_url: urlOptional,
  image_mobile_url: urlOptional,
  cta_text: z.string().trim().max(40, "Máximo 40 caracteres").optional().or(z.literal("")),
  cta_link: z
    .string()
    .trim()
    .max(300, "Máximo 300 caracteres")
    .regex(/^(\/|https?:\/\/).*/i, "Debe empezar por '/' o 'http(s)://'")
    .optional()
    .or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  sort_order: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z.number().int("Debe ser entero").min(0, "No puede ser negativo").max(9999, "Máximo 9999")
  ),
});
export type HeroSlideFormValues = z.infer<typeof heroSlideSchema>;

/* ============================================================
 * POS customer (cliente del ticket)
 * - express: solo nombre + (opcional) teléfono/dirección.
 * - avanzado/factura electrónica: exige docNumber + email.
 * ============================================================ */

export const posCustomerSchema = z
  .object({
    name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
    phone: z
      .string()
      .trim()
      .regex(/^[\d +()-]{6,20}$/, "Teléfono inválido")
      .optional()
      .or(z.literal("")),
    address: z.string().trim().max(120, "Máximo 120 caracteres").optional().or(z.literal("")),
    email: z.string().trim().email("Email inválido").max(120).optional().or(z.literal("")),
    docType: z.enum(["CC", "NIT", "CE", "PAS", "TI", "OTRO"]).default("CC"),
    docNumber: z
      .string()
      .trim()
      .max(20, "Máximo 20 caracteres")
      .regex(/^[\dA-Za-z-]*$/, "Solo letras, números y guiones")
      .optional()
      .or(z.literal("")),
    personType: z.enum(["natural", "juridica"]).default("natural"),
    taxResponsibility: z.string().max(60).optional().or(z.literal("")),
    city: z.string().trim().max(60).optional().or(z.literal("")),
    sendWhatsapp: z.boolean().default(false),
    sendEmail: z.boolean().default(false),
    /** Bandera del UI: activa validación avanzada (DIAN) o lo hace `requireEinvoice`. */
    advanced: z.boolean().default(false),
    requireEinvoice: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const needsDian = data.advanced || data.requireEinvoice;
    if (needsDian) {
      if (!data.docNumber || !data.docNumber.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["docNumber"],
          message: "Obligatorio para factura electrónica",
        });
      }
      if (!data.email || !data.email.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Obligatorio para factura electrónica",
        });
      }
    }
    if (data.sendWhatsapp && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Necesario para enviar por WhatsApp",
      });
    }
    if (data.sendEmail && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Necesario para enviar por Email",
      });
    }
  });
export type POSCustomerFormValues = z.infer<typeof posCustomerSchema>;

/* ============================================================
 * Util: primer error humano de un ZodError → mensaje "campo: error"
 * ============================================================ */
export function firstZodMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Datos inválidos";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}
