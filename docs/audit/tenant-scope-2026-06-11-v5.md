# Auditoría tenant-scope (refinada) — 2026-06-11

Archivos escaneados: **424**  ·  Hallazgos: **2**  
(high: 2, medium: 0, low: 0)

Generado por `scripts/audit-tenant-scope.ts` (Etapa 5).


## Top archivos a refactorizar (peso = high·5 + medium·2 + low·1)

- **5** — `src/lib/errors.ts`
- **5** — `src/modules/auth/pages/Login.tsx`

## Tablas más expuestas

- 1× → `x`

## HIGH (2)


### `src/lib/errors.ts` (1)
- L96 · select() without organization_id filter · `x`
  ```supabase.from('x').select())```

### `src/modules/auth/pages/Login.tsx` (1)
- L45 · hardcoded 'surteya' slug
  ```const isSurteya = brand.slug === "surteya";```

## MEDIUM (0)


## LOW (0)

