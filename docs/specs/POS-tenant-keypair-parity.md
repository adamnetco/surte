# POS-tenant-keypair-parity

**Estado:** IN_BUILD
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
- [ ] AC1: `tenant-create-with-owner` genera y persiste keypair Ed25519 cifrado en la misma transacción.
- [ ] AC2: Helper `_shared/tenant-keys.ts` reutilizable y testeado.
- [ ] AC3: Backfill ejecutado en Test sin errores; conteo final = `COUNT(organizations)`.
- [ ] AC4: TenantHealth muestra check "Firma criptográfica" con estado ok/warn.
- [ ] AC5: SSO handoff (`sso-issue` / `sso-consume`) funciona en tenants creados con la nueva ruta.

## Archivos a tocar
- `supabase/functions/_shared/tenant-keys.ts` (nuevo)
- `supabase/functions/tenant-create-with-owner/index.ts`
- `supabase/functions/sso-issue/index.ts` (verificar uso)
- `src/modules/superadmin/components/TenantHealth.tsx`
- `docs/runbooks/backfill-tenant-keys.sql` (nuevo)
- Migración: columnas `signing_public_key`, `signing_private_key_encrypted` en `organizations` si no existen.

## Notas
Pendiente de definir:
- ¿Reusar `AUTH_ENCRYPTION_KEY` o crear `TENANT_SIGNING_ENCRYPTION_KEY` separada?
- ¿Rotación periódica de claves? (probablemente fuera de scope inicial).
