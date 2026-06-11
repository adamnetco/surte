---
name: SaaS Refactor Etapa 2 — RPC provision_organization
description: Activación atómica de licencia/organización (RPC + edge function provision-organization)
type: feature
---

## Etapa 2 completada (2026-06-11)

### RPC `public.provision_organization`
Una sola transacción atómica que crea:
1. `organizations` (con slug único auto-resolvido)
2. `organization_members` (owner = admin)
3. `profiles` (vincula user_id ↔ organization_id)
4. `locations` (sede principal Bucaramanga)
5. `licenses` (status=active, public_key, signing_key_id)
6. `license_audit` (event=provisioned)
7. `organization_modules` (pos, inventory, catalog por defecto)
8. `onboarding_progress` (company_done=true, location_done=true)
9. `sync_outbox` × 2 → `welcome_email` + `welcome_whatsapp` (si hay phone ≥10 dígitos)

**Idempotencia:** UNIQUE index parcial en `licenses.payment_reference`. Si se reintenta con el mismo `payment_reference`, devuelve `{ idempotent: true, ... }` sin duplicar.

**Authz:** solo `superadmin` o `service_role`. EXECUTE revocado de PUBLIC.

### Edge function `provision-organization`
- Valida body con Zod
- Verifica que el caller sea superadmin (si viene JWT de usuario)
- `auth.admin.createUser({ email_confirm: false })` — si ya existe, lo busca por email
- Genera keypair Ed25519 → publica solo la clave pública
- Llama al RPC atómico
- Genera magic link de invitación
- Devuelve `{ organization_id, owner_user_id, license_id, license_key, slug, invite_link }`

### Pendiente (Etapa 3)
- Worker `welcome-dispatcher` que procese `sync_outbox` con `target IN ('welcome_email','welcome_whatsapp')`
- Template `organizationWelcomeTemplate` en `emailTemplates.ts`
- Cron pg_cron cada 1 min
- Realtime UI en `/licencias` para mostrar status de bienvenida

### Deprecación
`license-issue` queda pendiente de marcar como deprecated en Etapa 7. Mientras tanto, el frontend `/licencias` debe migrarse a `supabase.functions.invoke('provision-organization', { body })`.
