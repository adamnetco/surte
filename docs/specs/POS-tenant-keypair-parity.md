# POS-tenant-keypair-parity

**Estado:** SHIPPED
**Módulo:** superadmin / auth / multi-tenant
**Owner:** Eduardo

## Problema
La creación de tenant tiene dos caminos históricos:
- `provision-organization` (deprecado, retorna `410 Gone`) generaba un keypair Ed25519 para firmar artefactos del tenant (tokens SSO, JWT internos, callbacks firmados).
- `tenant-create-with-owner` (path activo) **no** genera keypair, así que tenants nuevos quedan sin material criptográfico propio.

Esto es un gap silencioso: features que asumen la existencia del keypair (SSO handoff, firma de webhooks) fallan en tenants creados por la nueva ruta.

## Diseño
1. Inventariar qué tablas/columnas usaba el keypair (`organizations.signing_public_key`, `organizations.signing_private_key_encrypted`, o tabla `tenant_keys`).
2. Mover la generación Ed25519 desde el código histórico a `_shared/tenant-keys.ts` y llamarla desde `tenant-create-with-owner` justo después de insertar la org.
3. Cifrar la clave privada con `AUTH_ENCRYPTION_KEY` (mismo patrón que `cf-accounts-manage`).
4. Backfill: script SQL `docs/runbooks/backfill-tenant-keys.sql` que genere keypairs faltantes para tenants creados sin clave (ejecutar Test → Live).
5. Health check en TenantHealth que marque "warn" si la org no tiene keypair.

## Criterios de Aceptación
- [x] AC1: `tenant-create-with-owner` genera y persiste keypair Ed25519 cifrado (`ensureTenantKeypair` tras insertar la org; campo `signing_keypair` en la respuesta).
- [x] AC2: Helper `_shared/tenant-keys.ts` reutilizable: `generateTenantKeypair`, `ensureTenantKeypair`, `loadTenantSigningKey`.
- [x] AC3: Backfill disponible vía edge function `backfill-tenant-keys` (superadmin, soporta `dry_run` y `organization_id`) + runbook SQL `docs/runbooks/backfill-tenant-keys.sql` para auditar antes/después. Ejecución operativa en Test/Live pendiente del operador.
- [x] AC4: TenantHealth muestra check "Firma criptográfica" con estado ok/warn según `organizations.signing_public_key`.
- [ ] AC5: SSO handoff hoy no firma con keypair (token-based). Diferido a un spec siguiente que migre `sso-issue`/`sso-consume` a JWT Ed25519 firmado con `loadTenantSigningKey`.

## Archivos tocados
- Migración: `organizations` + columnas `signing_public_key`, `signing_private_key_encrypted`, `signing_key_id`, `signing_key_created_at`.
- `supabase/functions/_shared/tenant-keys.ts` (nuevo)
- `supabase/functions/tenant-create-with-owner/index.ts` (integra `ensureTenantKeypair`)
- `supabase/functions/backfill-tenant-keys/index.ts` (nuevo)
- `docs/runbooks/backfill-tenant-keys.sql` (nuevo)
- `src/modules/superadmin/components/TenantHealth.tsx` (check "Firma criptográfica")

## Operación: backfill
```bash
# Inventario (no escribe)
curl -X POST "$SUPABASE_URL/functions/v1/backfill-tenant-keys" \
  -H "Authorization: Bearer $SUPERADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'

# Ejecutar para todos los faltantes
curl -X POST "$SUPABASE_URL/functions/v1/backfill-tenant-keys" \
  -H "Authorization: Bearer $SUPERADMIN_JWT" -H "Content-Type: application/json" -d '{}'

# Sólo una org
curl -X POST "$SUPABASE_URL/functions/v1/backfill-tenant-keys" \
  -H "Authorization: Bearer $SUPERADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"organization_id":"<uuid>"}'
```

## Notas
- Cifrado: `AUTH_ENCRYPTION_KEY` (mismo patrón que `auth-crypto.ts` / `cf-accounts-manage`). No se añade secreto nuevo.
- Rotación: fuera de scope; `signing_key_id` está listo para soportarla en un futuro spec.
