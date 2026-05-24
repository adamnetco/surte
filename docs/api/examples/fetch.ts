// Ejemplos en TypeScript usando fetch puro (sin SDK).
const URL = "https://dimyhjzcwlgfczimqhet.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbXloanpjd2xnZmN6aW1xaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODk1OTcsImV4cCI6MjA4OTc2NTU5N30.L2ERMQCCHYuJ51lhVffJaKIXKaVbwF0uGvkf-HxS6BI";

const headers = (token = ANON) => ({
  apikey: ANON,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

// Listar productos
export const listProducts = async () => {
  const res = await fetch(
    `${URL}/rest/v1/products?is_active=eq.true&select=id,name,price&limit=20`,
    { headers: headers() },
  );
  return res.json();
};

// Login
export const login = async (email: string, password: string) => {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  return res.json(); // { access_token, refresh_token, user }
};

// Crear pedido con token
export const createOrder = async (token: string, payload: object) => {
  const res = await fetch(`${URL}/rest/v1/orders`, {
    method: "POST",
    headers: { ...headers(token), Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return res.json();
};

// Invocar edge function
export const sendOrderWhatsApp = async (token: string, order_id: string) => {
  const res = await fetch(`${URL}/functions/v1/send-whatsapp-order`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ order_id }),
  });
  return res.json();
};
