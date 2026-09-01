# Arquitectura local-first por tenant (SistecPOS Core)

Estado: Fases 1 y 5–9 cerradas (modelo, contratos, outbox, push, pull incremental, conflictos, modo offline). Fases 10–15 planificadas por slices.

## 1. Separación de planos

| Plano | Responsable | Qué vive ahí |
|---|---|---|
| **Control plane** | Supabase/Postgres | licencias, activaciones, tenant manifest, usuarios/roles, auditoría, respaldo remoto, reportes agregados, restauración |
| **Operational plane** | Base local del tenant | catálogo, stock, clientes, ventas, pagos, caja, facturación pendiente, ajustes, impresoras |
| **Runtime** | Electron Desktop / PWA instalada | UI POS, hardware (ESC/POS, báscula), scheduler de sync |

Regla dura: **Supabase no puede ser requisito para vender, imprimir, abrir/cerrar caja ni consultar el catálogo ya sincronizado.**

## 2. Almacenamiento local

- **Desktop (objetivo):** SQLite cifrado, un archivo por tenant → `sistecpos_{organization_id}.db` en `userData`. Clave derivada de `machine fingerprint + activation token` (nunca se guarda en claro, nunca se guarda `service_role`).
- **Web/PWA (hoy):** Dexie/IndexedDB, una base por tenant → `sistecpos_offline_{organization_id}` (ya implementado en `src/modules/offline/lib/db.ts`).
- Cambiar de tenant **cierra** la base anterior; nunca se comparten stores.
- Toda fila local lleva `id`, `organization_id`, `created_at`, `updated_at`, `deleted_at?`, `sync_status`, `server_updated_at?`.

## 3. Contratos de sincronización

- **tenant manifest**: configuración autorizada (org, sucursales, módulos, plan, branding, fiscal, POS, impresoras, permisos). Emitido por `desktop-tenant-bootstrap` al activar licencia.
- **snapshot inicial**: catálogo activo + stock + ajustes, ya filtrado por `organization_id`.
- **outbox**: toda escritura local genera un evento (`client_operation_id` como clave de idempotencia).
- **inbox/pull**: cambios remotos de otras terminales, incrementales por `updated_at` + tombstones.
- **checkpoints**: cursor por tabla y por dispositivo.
- **conflicts**: ventas y pagos append-only; inventario por movimientos; configuración fiscal gana el servidor; cierre de caja duplicado = conflicto explícito.

## 4. Estado actual del código

Ya implementado:
- Base local particionada por `organization_id` (Dexie v2) con catálogo, tickets del turno y clientes frecuentes.
- Outbox local con idempotencia por `client_uuid` (`src/modules/offline/lib/outbox.ts`).
- Commit atómico remoto de la venta vía RPC `pos_sale_commit` (todo-o-nada, idempotente).
- Bootstrap de tenant vía Edge Function `desktop-tenant-bootstrap` + manifiesto cifrado en Electron.
- **Catálogo offline filtrado por `organization_id`** en lectura remota y en lectura local (defensa contra bases legacy).

## 4.1 Motor de sincronización (Fases 5–9, implementado)

| Fase | Entrega | Dónde |
|---|---|---|
| 5 · Outbox | idempotencia por `client_uuid`, backoff exponencial, GC de eventos aplicados, escalado a conflicto al agotar reintentos | `src/modules/offline/lib/outbox.ts` |
| 6 · Push | commit atómico remoto vía RPC `pos_sale_commit` (todo o nada, 1 round-trip) | `outbox.ts` → Postgres |
| 7 · Pull incremental | cursor por entidad y tenant en `syncCheckpoints`, paginado por `updated_at`, tombstones vía `is_active = false` | `src/modules/offline/lib/sync.ts` |
| 8 · Conflictos | bitácora local `syncConflicts` (`outbox_gave_up`, `remote_newer`, `duplicate_close`) + resolución manual desde la UI | `sync.ts`, `SyncStatusPanel.tsx` |
| 9 · Modo offline | `readiness()` indica si el terminal puede vender sin red (catálogo local + cola pendiente) y lo expone en el panel de estado | `sync.ts`, `src/components/SystemStatusDialog.tsx` |

Contrato: `src/core/ports/ISyncEngine.ts`. La UI nunca llama Supabase para sincronizar: usa `syncEngine`.
Base local Dexie v3 añade `syncCheckpoints` y `syncConflicts` sin borrar datos existentes.

Pendiente por slices:
1. SQLite cifrado en Desktop detrás de la misma interfaz local (Fase 10).
2. Repositorios locales para stock, caja, clientes y ajustes (`ILocalCatalogRepository` como patrón de referencia).
3. Extender el pull incremental a clientes, stock y ajustes (hoy cubre catálogo).
4. Espejo remoto de conflictos para soporte central.
5. Flujo de restauración completo desde snapshot remoto (Fase 11).
6. Suite de tests: venta offline, no duplicación en sync, aislamiento tenant A/B, restore (Fase 14).

## 5. Riesgos abiertos

- Módulos admin siguen leyendo Supabase directo (correcto: son control plane, requieren conexión).
- Facturación electrónica DIAN requiere conexión por ley: se encola local y se emite al reconectar.
- Migración Dexie → SQLite debe mantener la misma interfaz para no tocar la UI del POS.
