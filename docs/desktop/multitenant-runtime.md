# Runtime Desktop genérico + Tenant Package

SistecPOS Core se distribuye como **un solo ejecutable genérico**. Ningún tenant
está compilado dentro del binario: la identidad llega en tiempo de ejecución.

```
SistecPOS Core
├─ Web/PWA multi-tenant
├─ Desktop runtime genérico (mismo .exe/.app/.tar.gz para todos)
│  ├─ Electron shell (electron/main.cjs)
│  ├─ Print agent (electron/print-agent.cjs)
│  ├─ Offline cache (IndexedDB por organization_id)
│  ├─ License activation (license-activate)
│  └─ Auto-update (desktop_releases, global)
└─ Tenant package (tenant_manifest, servido por backend)
```

## 1. Neutralización de identidad

| Antes | Ahora |
|---|---|
| `window.surteyaDesktop` | `window.sistecposDesktop` (+ alias legacy deprecado) |
| `SURTEYA_SUPA_URL/ANON` | `SISTECPOS_SUPA_URL/ANON` (fallback legacy) |
| `SURTEYA_PRINT_AGENT_PORT` | `SISTECPOS_PRINT_AGENT_PORT` (fallback legacy) |
| `~/.surteya-print-agent` | `~/.sistecpos-print-agent` (usa el legacy si existe) |
| Diálogos con marca de un tenant | Copys genéricos "SistecPOS Core" |

El cifrado local (`license.dat`, `activation.token`, `tenant_manifest.dat`)
usa salt `::sistecpos` y conserva lectura del salt legacy para no forzar
reactivaciones.

## 2. Tenant manifest

Construido en `supabase/functions/_shared/tenantManifest.ts` a partir de
`organizations`, `organization_modules`, `app_settings`, `locations`,
`einvoice_configs` y `printers`. Contiene:

- `organization_id`, `slug`, `name`, `logo_url`, colores
- `enabled_modules`, `plan`
- `locations`, `fiscal` (e-invoice), `printer_defaults`, `feature_flags`
- `offline_bootstrap_version` (hash corto para invalidar caché)

Nunca se acepta `organization_id` del cliente: se deriva de la licencia.

## 3. Flujo de activación

1. Superadmin crea la organización y emite licencia (`max_terminals`).
2. El cliente instala el ejecutable genérico.
3. Al abrir, el runtime muestra su **fingerprint** y pide la clave.
4. `license-activate` valida cupo, firma token Ed25519 y devuelve
   `organization_id` + `tenant_manifest` + `bootstrap_url`.
5. El manifiesto se guarda cifrado en `userData/tenant_manifest.dat`.
6. El heartbeat (cada 30 min) revalida el seat y refresca el manifiesto
   (`desktop-tenant-bootstrap`), emitiendo `tenant:manifest-change`.
7. Si la licencia se revoca/suspende/expira: **wipe** de licencia, token y
   manifiesto, y cierre de la app.

## 4. Releases globales

`desktop_releases` es global por plataforma/canal — no hay builds por tenant.
La tienda ve el instalador en su pestaña de Descargas; el binario es idéntico
para todos y solo la licencia lo vincula a una organización.

## 5. Aislamiento offline

`src/modules/offline/lib/db.ts` abre `sistecpos_offline_<organization_id>`.
Cambiar de tienda cierra la base anterior y abre otra: catálogo, tickets del
turno, clientes y outbox nunca se mezclan. Utilidades:

- `setOfflineOrganization(orgId)` — invocado por `OrganizationContext`.
- `getOfflineDBName()` — diagnóstico.
- `clearOfflineTenantData()` — borrado total del tenant activo.

## 6. Empaquetado limpio

`electron/package.json` excluye `src`, `public`, `supabase`, `docs`, `e2e`,
`scripts`, `astro-starter`, `tests`, `.lovable` y cualquier `.env`. El bundle
solo contiene `dist/` + `electron/`.

## 7. Verificación

```bash
npm run build:desktop          # dist con base relativa
cd electron && npm run package:win
# Comprobar que el paquete NO contiene .env, supabase/ ni docs/
```

Prueba manual de aislamiento: activar dos licencias distintas en dos equipos
(o dos perfiles de usuario) y comprobar en DevTools → Application → IndexedDB
que existen dos bases con sufijo distinto.
