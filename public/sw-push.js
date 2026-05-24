/// <reference lib="webworker" />
// Companion service worker: handles Web Push + Background Sync.
// Caching is handled by Workbox's auto-generated SW.

// ── Web Push ──────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "SistecPOS", body: "Tienes una nueva notificación", url: "/", icon: "/icons/icon-192.png" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
      vibrate: [120, 60, 120],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => w.url.includes(target));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});

// ── Background Sync ───────────────────────────────────────────────────
// The actual Supabase calls live in the page (they need the user session +
// generated client). The SW's job is to wake an open client and ask it to
// process the outbox. This is the recommended pattern for auth-bound work.
async function notifyClientsToFlush() {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of list) c.postMessage({ type: "outbox-flush" });
  // If no client is open, we cannot flush from here (Supabase JS needs the
  // session). The next page load will pick it up via wireOutboxListeners().
}

self.addEventListener("sync", (event) => {
  if (event.tag === "outbox-sync") {
    event.waitUntil(notifyClientsToFlush());
  }
});

// Manual ping from the page (fallback when SyncManager is unavailable).
self.addEventListener("message", (event) => {
  if (event.data?.type === "request-flush") {
    event.waitUntil(notifyClientsToFlush());
  }
});
