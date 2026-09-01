# Plan de migración a PGLite como motor local del POS

Estado: **planificado**. Hoy el plano operativo corre sobre Dexie/IndexedDB
detrás de `ILocalCatalogRepository` + `ISyncEngine` (ver
`local-first-tenant.md`), y ya vende, cobra y arquea sin red.

Este documento define cómo cambiar el **motor de persistencia** sin tocar la UI
del POS ni el flujo de venta actual.

## 1. Por qué PGLite

| | Dexie / IndexedDB (hoy) | PGLite (objetivo Desktop) |
|---|---|---|
| Modelo | key-value con índices | Postgres real (WASM) |
| Consultas | filtros en JS | SQL, joins, agregados, vistas |
| Arqueos y reportes locales | recalculados en memoria | una query SQL |
| Paridad con el servidor | esquema distinto | **mismo SQL que Supabase** |
| Transacciones multi-tabla | limitadas | `BEGIN/COMMIT` real |
| Disponibilidad | navegador + Electron + Tauri | Electron/Tauri (Node/WASM con FS) |

El valor decisivo es la **paridad de esquema**: las mismas migraciones que
Postgres, y el commit de venta local puede replicar `pos_sale_commit`.

## 2. Regla de arquitectura

PGLite es un **adaptador**, no una dependencia de la UI.

```
core/ports/ILocalDatabase.ts        ← contrato (ya existe el patrón)
infrastructure/local/DexieCatalogRepository.ts     ← actual (web/PWA)
infrastructure/local/PgliteCatalogRepository.ts    ← nuevo (desktop)
```

Selección por runtime: `isTauriRuntime() || isElectron()` → PGLite;
navegador → Dexie. Ningún componente de `presentation/` cambia.

## 3. Fases

| Fase | Entrega | Criterio de aceptación |
|---|---|---|
| P1 | `ILocalDatabase` + esquema SQL local versionado (`local_migrations`) | migraciones aplican sobre archivo vacío y sobre uno existente |
| P2 | `PgliteCatalogRepository` con la misma superficie que el adaptador Dexie | tests de contrato compartidos pasan en ambos adaptadores |
| P3 | Outbox y checkpoints en tablas SQL (`outbox`, `sync_checkpoints`, `sync_conflicts`) | idempotencia por `client_uuid` preservada |
| P4 | `pos_sale_commit` local (función SQL local equivalente) | venta + pagos + movimientos en una transacción atómica |
| P5 | Persistencia por tenant: `sistecpos_<organization_id>.db` en `userData`, cifrado con clave derivada de fingerprint + activation token | cambiar de tienda cierra la base anterior; A/B nunca se mezclan |
| P6 | Migración de datos Dexie → PGLite al primer arranque | outbox pendiente se traslada sin duplicar ventas |
| P7 | Arqueos y reportes locales por SQL | cierre de caja sin red idéntico al de la nube |
| P8 | Tests: venta offline, no duplicación al sincronizar, aislamiento tenant, restore desde snapshot | suite verde en CI |

## 4. Riesgos y mitigación

- **Tamaño del bundle WASM (~3 MB):** se carga sólo en el runtime de escritorio,
  nunca en el bundle web (import dinámico + presupuesto en `perf-budget.json`).
- **Doble motor durante la transición:** los tests de contrato compartidos son
  obligatorios; cualquier método nuevo debe implementarse en ambos adaptadores.
- **Cifrado:** la clave no se persiste en claro; si falla la derivación, la app
  no abre la base (fail-closed) en lugar de degradar a texto plano.
- **Migración de datos:** el traslado del outbox se hace por `client_uuid`, con
  la misma clave de idempotencia, así que un traslado repetido no duplica.

## 5. Qué NO cambia

- `ISyncEngine`, la Edge Function `desktop-tenant-bootstrap`, el manifiesto de
  tenant, el commit remoto `pos_sale_commit` y toda la UI del POS.
- El plano de control (licencias, usuarios, reportes agregados) sigue en
  Supabase y sigue requiriendo conexión.
