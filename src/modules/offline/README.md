# offline module

Offline-first primitives for the POS: Dexie/IndexedDB catalog cache and outbox sync.

## Contents

- `lib/db.ts` — Dexie schema (catalog snapshot + outbox tables).
- `lib/catalog.ts` — catalog snapshot read/write helpers (products, presentations, prices).
- `lib/outbox.ts` — enqueue/flush for `pos_order`, `payment`, `einvoice`, `stock` operations.
- `hooks/useOnlineStatus.ts` — reactive online/offline state.
- `components/OfflineIndicator.tsx` — UI banner for offline state.

## Rules

- Import via `@/modules/offline` (barrel) — no deep paths.
- Outbox payloads MUST be self-contained (no DOM refs, no Supabase client instances) — they survive page reloads.
- Server-side flush lives in `supabase/functions/sync-outbox-flush` / `sync-outbox-retry`; this module is browser-only.
- No cross-module imports. Only depends on `dexie` and `@/integrations/supabase/client`.

## Next module

Suggested: `email` (mailService + emailTemplates) or `tenant` (resolveTenant, tenantDataIsland, tenantScope, subdomain helpers).
