# POS-domain-assignment-flow

**Estado:** SHIPPED
**Módulo:** superadmin / sitios + cloudflare
**Owner:** Eduardo (superadmin maestro)
**Fecha SHIPPED:** 2026-06-18

## Problema
Auditoría end-to-end del flujo de asignación de dominios (tenant → site → domain → Cloudflare → SSL → TenantHealth) detectó:
- DomainWizard usaba mocks (no llamaba edge functions reales).
- `cname_target` se generaba con un valor incorrecto basado en `zoneId`.
- `tenant-create-with-owner` invocaba CF connect fire-and-forget sin feedback → tenants quedaban sin `cf_hostname_id` y reprovisionar fallaba con `not_registered`.
- Cuentas Cloudflare vivían en `localStorage` (no en DB, sin cifrado).
- Dos paths de creación de tenant (`provision-organization` vs `tenant-create-with-owner`).
- Añadir dominio y conectar a CF eran pasos separados.
- Tres verificaciones TXT dispersas, sin checklist unificado.
- TenantHealth no hacía deep-link al tab correcto.
- `setPrimary` ejecutaba dos UPDATEs sin transacción (race condition).
- Polling indefinido sin pausa.
- Reprovisionar SSL cambiaba método de validación sin avisar al usuario.

## Diseño
Tres fases en tres PRs.

### Fase 1 — Crítica
- **C4** `cloudflare-domain-connect/index.ts:27,113,131` lee `CLOUDFLARE_FALLBACK_HOSTNAME` con fallback a zona.
- **C1** `DomainWizard.tsx` invoca `cloudflare-domain-connect` y `cloudflare-domain-status` reales.
- **C5** `tenant-create-with-owner/index.ts` retorna `cf_kickoff { ok, cf_hostname_id, error? }`. `SiteDetailsPanel.tsx` añade botón **Registrar en Cloudflare** y deshabilita Verificar/Reprovisionar mientras falte `cf_hostname_id`.

### Fase 2 — Consolidación
- **C2** Edge function `cf-accounts-manage` con cifrado AES-GCM (`AUTH_ENCRYPTION_KEY`). `CloudflareAccountsTab` migrado de `localStorage` a DB.
- **C3** `provision-organization` retorna `410 Gone` (deprecado).
- **I1** `Sitios.tsx::add` inserta dominio y abre el wizard inmediatamente.

### Fase 3 — UX refinement
- **I2** RPC `set_primary_tenant_domain(p_domain_id uuid)` SECURITY DEFINER (migración `20260618060601`).
- **I3** Badge "Cloudflare SaaS (CNAME)" vs "Legacy (A directo)" en `SiteDetailsPanel`.
- **I4** Checklist DNS unificado incluye TXT `_lovable-tenant` (verificación SistecPOS).
- **I5** Deep-links `?tab=sites|domains|cloudflare` desde TenantHealth.
- **I6** Confirm de Reprovisionar explica el switch SSL HTTP→TXT.
- **I7** Pausa manual del polling + auto-pausa si `document.hidden`.

## Criterios de Aceptación
- [x] AC1: Wizard llama edge functions reales (no mocks).
- [x] AC2: `cname_target` usa `CLOUDFLARE_FALLBACK_HOSTNAME`.
- [x] AC3: Registro CF en `tenant-create-with-owner` reportable; botón manual disponible.
- [x] AC4: Cuentas CF persistidas en `tenant_cloudflare_accounts` con token cifrado.
- [x] AC5: `provision-organization` retorna 410.
- [x] AC6: Crear dominio dispara el wizard inmediatamente.
- [x] AC7: `setPrimary` ejecuta vía RPC atómico.
- [x] AC8: UI distingue `dns_mode` y muestra checklist DNS unificado.
- [x] AC9: TenantHealth navega al tab correcto en `/sitios`.
- [x] AC10: Polling pausable y auto-pausa con pestaña oculta.

## Notas
Reporte de revisión POS-review aprobado el 2026-06-18. Observaciones derivadas → specs hijos:
- `POS-cf-env-vars`
- `POS-tenant-keypair-parity`
- `POS-tenanthealth-focus-domain`
