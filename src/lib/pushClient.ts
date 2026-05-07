import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function abToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getCurrentPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!(await isPushSupported())) return "unsupported";
  return Notification.permission;
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!(await isPushSupported())) return { ok: false, error: "Tu navegador no soporta notificaciones push." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, error: "Permiso denegado." };

  const reg = (await navigator.serviceWorker.getRegistration("/")) ||
    (await navigator.serviceWorker.register("/sw-push.js", { scope: "/" }));
  await navigator.serviceWorker.ready;

  const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
  if (error || !data?.publicKey) return { ok: false, error: "No se pudo obtener la clave pública." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey).buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON() as any;
  const p256dh = json.keys?.p256dh ?? abToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? abToBase64(sub.getKey("auth"));

  const { data: userData } = await supabase.auth.getUser();
  const { error: insErr } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user?.id ?? null,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      is_active: true,
    },
    { onConflict: "endpoint" },
  );
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  if (!(await isPushSupported())) return { ok: false };
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").update({ is_active: false }).eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return { ok: true };
}
