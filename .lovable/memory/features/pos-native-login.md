---
name: POS Native Login
description: Acceso al POS desde /clientes ahora es nativo (React Router → /pos), eliminando el legado softwarepos.online (PHP) traído de sistecpos.com
type: feature
---

# POS Native Login

## Regla
El portal de clientes (`/clientes` → tab "Mi POS") **NUNCA** debe abrir
`softwarepos.online` ni ningún sistema PHP heredado. Todo el acceso al POS
ocurre dentro de SistecPOS Core en la ruta nativa `/pos` (POSWorkspace).

## Por qué
SistecPOS Core es una app React/Vite/Supabase autónoma. El bridge a
`softwarepos.online/index.php/login/index/1` fue copiado desde sistecpos.com
y rompía la experiencia (nueva pestaña, doble login, datos desincronizados).

## Cómo se aplica
- `ClientPOSAccess.tsx` usa `useNavigate()` → `/pos`.
- Valida `useAuth()`, `useOrganization()` (currentOrg + hasModule("pos_counter"))
  antes de navegar. Si falta, redirige a `/onboarding?org=<id>`.
- `ClientPOSLogin.tsx` fue eliminado (duplicado del flujo legado).
- ESLint debería bloquear cualquier reintroducción de `softwarepos.online`
  (pendiente Fase 5 del plan).

## Componentes vinculados
- `src/modules/clientes/components/ClientPOSAccess.tsx` — entrada principal
- `src/modules/pos/pages/POS.tsx` — destino (`/pos`)
- `src/modules/platform/context/OrganizationContext.tsx` — provee `currentOrg`, `hasModule`

## Tareas pendientes (Fases 2-5 del plan)
Ver `.lovable/plan.md` para semillas demo, RBAC, cleanup de edge functions
y guardarraíles (Playwright + ESLint no-restricted-syntax).
