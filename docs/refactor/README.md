# Refactor — SurteYa como tenant autónomo

Etapas 32 → 40 del plan en `.lovable/plan.md`. Skill base: **POS-fix-hardcoding**.

## Artefactos

- `hardcoding-surteya.csv` — inventario completo clasificado.
- `../../scripts/audit-hardcoding.ts` — guarda anti-regresión (Etapa 40 lo conecta a CI).

## Baseline Etapa 32

| Métrica | Valor |
|---|---|
| Hallazgos totales | **241** |
| Archivos afectados | 74 |
| `SEED` (migraciones) | 114 |
| `COPY` (UI literal) | 80 |
| `CONFIG` (lógica/condicional) | 38 |
| `TEST` | 7 |
| `DOC` | 2 |

### Top módulos

| Módulo | Hits |
|---|---|
| migrations | 114 |
| admin-cms | 31 |
| storefront | 20 |
| marketing | 10 |
| pages | 8 |
| components | 7 |
| superadmin | 7 |
| email | 6 |

## Mapeo etapa → tipo

- **Etapa 33** — modelo de datos (`organizations` + `app_settings`) que sostiene los `CONFIG`/`COPY`.
- **Etapa 34** — hooks `useTenant*` que consumen ese modelo.
- **Etapas 35-36** — eliminar `COPY` y `CONFIG` de storefront / admin / POS / auth.
- **Etapa 37** — `SEED` y edge functions. Migraciones históricas no se tocan; se aísla SurteYa en un seed propio.
- **Etapa 38** — categorías genéricas vía `catalog_templates`.
- **Etapa 39** — cutover y e2e.
- **Etapa 40** — `audit-hardcoding.ts` en CI + ESLint `no-tenant-hardcode`.

## Cómo correr la auditoría

```bash
deno run --allow-read --allow-run scripts/audit-hardcoding.ts
```

Sale con código 1 si los hits superan el `BASELINE` declarado en el script. Cada etapa baja el baseline.
