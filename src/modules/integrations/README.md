# integrations module

Third-party service integrations exposed to the rest of the app.

## Sub-modules

- `whatsapp/` — universal `wa.me` opener, Meta WhatsApp Flow JSON template, `useWhatsAppConfig` hook (number, default messages, opt-out flags). Used by storefront checkout, FloatingWhatsApp, ClientPortal billing, NotificationBanner.
- `sync/` — `useSyncService` hook around `sync_outbox` / `sync_logs` plus the `sync-outbox-flush` edge function. Used by POSWorkspace and admin SyncStatusTable.
- (planned) `ycloud/` — thin client around the `send-ycloud-whatsapp` and `broadcast-whatsapp-ycloud` edge functions.

## Rules

- Import via the barrel `@/modules/integrations` — no deep paths.
- WhatsApp templates MUST stay plain text (no emojis) per project rule — see `whatsapp.ts` for the sanitizer.
- Edge functions stay under `supabase/functions/*`; this module only ships browser/runtime code.
- No cross-module imports. Only depends on `@/integrations/supabase/client`, `@tanstack/react-query`, and `@/lib/utils`.

## Next module

Suggested: `offline` (Dexie catalog + outbox) or `email` (mailService + emailTemplates + Resend wrappers).
