/// <reference lib="webworker" />
// Custom service worker logic merged into Workbox's auto-generated SW
// via VitePWA's `injectManifest` is NOT used here — we use generateSW.
// This file exists so push events work via a small companion SW served
// at /sw-push.js, registered alongside the generated one.
//
// Most of the time this file is unused; the generated workbox SW handles
// caching and the browser's own push handler reads from the registration
// linked to the active SW. We listen for push and notificationclick.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "SURTÉ YA", body: "Tienes una nueva notificación", url: "/", icon: "/icons/icon-192.png" };
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
