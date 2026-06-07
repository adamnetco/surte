# Módulo POS

Primera migración de la Etapa 1 del refactor (`.lovable/plan.md`).

## Estructura

```text
src/modules/pos/
  components/   UI del workspace, diálogos de cobro/cierre, sheets, etc.
  hooks/        usePOSHotkeys, usePOSModes
  lib/          posModes, posBusinessPresets, posCustomer
  pages/        POS, PosHub, KDS, Mesas, MenuPage
  index.ts      API pública del módulo
```

## Reglas

- **Fuera del módulo solo se importa desde `@/modules/pos`** (el barril
  `index.ts`). Nunca de `@/modules/pos/components/...` directo.
- Lo que necesite exponerse a Admin (ej. `usePOSModes`, `POS_MODES`) se
  añade conscientemente al barril.
- Tests co-localizados (`*.test.tsx`) se quedan junto al componente.
- Edge functions y tablas siguen viviendo en `supabase/`; este módulo
  solo agrupa la capa frontend del dominio POS.

## Consumidores externos actuales

- `src/App.tsx` → rutas `/pos`, `/pos-hub`, `/mesas`, `/kds`, `/menu`.
- `src/components/admin/POSModesSettings.tsx` → `usePOSModes`.

Cualquier nuevo consumidor debe pasar por el barril o agendar la
exposición en este README.

## Próximos módulos a migrar (Etapa 1)

`storefront`, `admin-cms`, `superadmin`, `clientes`, `auth`. Cada uno en
su propio PR para que el e2e valide la migración antes de continuar.
