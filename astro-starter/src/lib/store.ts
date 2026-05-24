// Lectura pública de catálogo (categorías, productos, pedidos) desde Supabase REST.
// Filtra por organization_id resuelto vía tenant.

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL!;
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

export const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n ?? 0);

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface Category {
  id: string; name: string; slug: string; icon: string | null;
  meta_title: string | null; meta_description: string | null; og_image_url: string | null;
}

export interface Product {
  id: string; name: string; slug: string; description: string | null;
  price: number; original_price: number | null; image_url: string | null;
  brand: string | null; sku: string | null; gtin: string | null;
  meta_title: string | null; meta_description: string | null;
  unit: string | null; unit_quantity: number | null; unit_measure: string | null;
  category_id: string | null; availability: string | null;
  is_active: boolean;
}

export const listCategories = (orgId: string) =>
  rest<Category[]>(`categories?organization_id=eq.${orgId}&is_active=eq.true&order=sort_order.asc,name.asc`);

export const listProducts = (orgId: string, categorySlug?: string) => {
  let q = `products?organization_id=eq.${orgId}&is_active=eq.true&select=*,category:categories(slug,name)&order=name.asc&limit=200`;
  if (categorySlug) q += `&category.slug=eq.${categorySlug}`;
  return rest<(Product & { category?: { slug: string; name: string } | null })[]>(q);
};

export const getProductBySlug = async (orgId: string, slug: string) => {
  const rows = await rest<(Product & { category?: { slug: string; name: string } | null })[]>(
    `products?organization_id=eq.${orgId}&slug=eq.${slug}&select=*,category:categories(slug,name)&limit=1`,
  );
  return rows[0] ?? null;
};

export const getCategoryBySlug = async (orgId: string, slug: string) => {
  const rows = await rest<Category[]>(`categories?organization_id=eq.${orgId}&slug=eq.${slug}&limit=1`);
  return rows[0] ?? null;
};

export interface Order {
  id: string; order_number: string; status: string;
  customer_name: string | null; customer_phone: string | null;
  customer_address: string | null; total: number; subtotal: number | null;
  delivery_price: number | null; created_at: string; notes: string | null;
}

export const getOrderByNumber = async (orgId: string, number: string) => {
  const rows = await rest<Order[]>(
    `orders?organization_id=eq.${orgId}&order_number=eq.${number}&select=id,order_number,status,customer_name,customer_phone,customer_address,total,subtotal,delivery_price,created_at,notes&limit=1`,
  );
  return rows[0] ?? null;
};
