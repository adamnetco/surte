# notifications module

Web Push opt-in and client helpers. Backed by `public/sw-push.js` (kept at the public root for browser registration scope) and Supabase Realtime channels.

## Contents

- `components/PushOptIn.tsx` — opt-in UI that subscribes the browser to push.
- `lib/pushClient.ts` — VAPID key fetch, subscribe/unsubscribe, payload helpers.

## Rules

- Import via `@/modules/notifications` (barrel) — no deep imports.
- The service worker file `public/sw-push.js` must stay at `/sw-push.js` (browser scope requirement) — do NOT move it.
- No cross-module imports. Only depends on `@/integrations/supabase/client` and shadcn UI.

## Next module

Suggested: `integrations` (whatsapp, ycloud, sync) or `offline` (Dexie catalog + outbox).
