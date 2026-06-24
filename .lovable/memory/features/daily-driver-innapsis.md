---
name: Daily Driver & Innapsis UX
description: Mobile-first /admin/diario hub, collapsible drawer, Innapsis listing+detail timeline, persisted daily checklist with inline notes
type: feature
---

## /admin/diario (Daily Driver)
- Mobile-first hub for admin: greeting, KPIs (ventas/pendientes), prioritized actions sorted by severity (danger→warn) from real data, atajos, checklist.
- `useDailySnapshot` aggregates orders today, pendientes, low stock (≤5), sync errors 24h, einvoice errors 24h. Refetch 60s + manual + error retry.
- Actions weighted by severity × count; einvoice errors → /admin/innapsis, sync → /admin/health-logs.

## Daily checklist
- Table `public.daily_checklist` (org+user+day+item_key unique). Hook `useDailyChecklist` hydrates from localStorage cache then Supabase. Auto-resets per local day.
- Inline notes via `ChecklistRow` (StickyNote toggle). Cmd/Ctrl+Enter or blur saves; Esc cancels. Max 500 chars. Amber tint when notes present.

## AdminMobileDrawer (AC14)
- Sheet drawer with collapsible groups (Tu día / Operación / Negocio). Expanded state persisted in localStorage (`sistecpos:admin-drawer:open-groups`).
- Active route highlighted: left primary bar, primary/10 bg, primary icon. Group containing active route auto-expands and shows a dot indicator.
- Match by `pathname === path || pathname.startsWith(path + "/")`.

## Innapsis module
- `/admin/innapsis`: listing of `electronic_invoices` with search (number/cliente/NIT/CUFE), status filter chips with counts, retry via `supabase.functions.invoke("innapsis-emit", { invoice_id, forced_retry })`. Auto-refetch 30s.
- `/admin/innapsis/:id`: detail page with header (factura, cliente, total, last_error block), action buttons (PDF/XML/CUFE/Retry), and **timeline from `einvoice_events`** ordered desc, refetch 15s. Each event: icon by event_type (emitted/accepted/rejected/retry/contingency), timestamp, status, message, collapsible payload/response JSON.
