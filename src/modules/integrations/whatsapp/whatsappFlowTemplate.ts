/**
 * WhatsApp Flow — JSON template for Flow Designer.
 *
 * This schema mirrors the tenant `products` table fields so that the
 * Meta WhatsApp Flow Designer can read/write a cart that is identical to
 * the web `persistent_carts` row addressed by `cart_token`.
 *
 * Field mapping (Supabase → Flow):
 *   products.id            → product_id   (string, uuid)
 *   products.name          → name         (string)
 *   products.price         → price        (number, COP)
 *   products.image_url     → image_url    (string, https)
 *   products.unit          → unit         (string)
 *   products.stock         → stock        (number)
 *   products.slug          → slug         (string)
 *
 * The cart payload sent back from the Flow webhook MUST match
 * `persistent_carts.items` (jsonb) so `upsert_persistent_cart` accepts it
 * without transformation.
 */

export const WHATSAPP_FLOW_TEMPLATE = {
  version: "5.0",
  data_api_version: "3.0",
  routing_model: {
    PRODUCT_LIST: ["CART_REVIEW"],
    CART_REVIEW: ["CHECKOUT"],
    CHECKOUT: [],
  },
  screens: [
    {
      id: "PRODUCT_LIST",
      title: "Catálogo",
      terminal: false,
      data: {
        cart_token: { type: "string", __example__: "00000000-0000-0000-0000-000000000000" },
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              name: { type: "string" },
              price: { type: "number" },
              image_url: { type: "string" },
              unit: { type: "string" },
              stock: { type: "number" },
              slug: { type: "string" },
            },
          },
          __example__: [
            {
              product_id: "uuid-aqui",
              name: "Pulpa de mango 500g",
              price: 12000,
              image_url: "https://example.com/img/mango.jpg",
              unit: "bolsa",
              stock: 24,
              slug: "pulpa-mango-500g",
            },
          ],
        },
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextHeading", text: "Elige tus productos" },
          {
            type: "CheckboxGroup",
            name: "selected_items",
            label: "Productos disponibles",
            "data-source": "${data.products}",
          },
          {
            type: "Footer",
            label: "Continuar al carrito",
            "on-click-action": {
              name: "navigate",
              next: { type: "screen", name: "CART_REVIEW" },
              payload: {
                cart_token: "${data.cart_token}",
                selected_items: "${form.selected_items}",
              },
            },
          },
        ],
      },
    },
    {
      id: "CART_REVIEW",
      title: "Tu carrito",
      terminal: false,
      data: {
        cart_token: { type: "string", __example__: "" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              name: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              line_total: { type: "number" },
            },
          },
          __example__: [],
        },
        subtotal: { type: "number", __example__: 0 },
        total_items: { type: "number", __example__: 0 },
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextHeading", text: "Resumen del pedido" },
          {
            type: "Footer",
            label: "Confirmar pedido",
            "on-click-action": {
              name: "data_exchange",
              payload: {
                cart_token: "${data.cart_token}",
                items: "${data.items}",
                subtotal: "${data.subtotal}",
                total_items: "${data.total_items}",
              },
            },
          },
        ],
      },
    },
    {
      id: "CHECKOUT",
      title: "Datos de entrega",
      terminal: true,
      success: true,
      data: {
        cart_token: { type: "string", __example__: "" },
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextInput", name: "customer_name", label: "Nombre", required: true },
          { type: "TextInput", name: "customer_address", label: "Dirección", required: true },
          {
            type: "Footer",
            label: "Crear pedido",
            "on-click-action": {
              name: "complete",
              payload: {
                cart_token: "${data.cart_token}",
                customer_name: "${form.customer_name}",
                customer_address: "${form.customer_address}",
              },
            },
          },
        ],
      },
    },
  ],
} as const;

/**
 * Cart line schema — keep in sync with `persistent_carts.items`.
 */
export interface PersistentCartLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  image_url?: string | null;
  presentation_id?: string | null;
  presentation_name?: string | null;
}

/**
 * Build the deep-link wa.me URL that carries the cart_token so that any
 * WhatsApp Flow webhook can retrieve the cart via `get_persistent_cart`.
 */
export const buildCartHandoffLink = (
  whatsappNumber: string,
  cartToken: string,
  customMessage?: string,
): string => {
  const phone = (whatsappNumber || "").replace(/\D/g, "");
  const msg = customMessage || `Quiero retomar mi carrito CART:${cartToken}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
};
