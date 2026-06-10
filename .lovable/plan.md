# Plan de refactorización y optimización — SistecPOS Core

## Objetivo

Auditar y limpiar el flujo de ingreso al POS. Hoy, al pulsar "Ingresar al POS" desde `/clientes`, la app abre una nueva pestaña hacia `https://softwarepos.online/index.php/login/index/1` — un sistema **PHP heredado** que se trajo copiado desde sistecpos.com y que ya no aplica aquí. SistecPOS Core tiene su propio POS nativo en `/pos` (módulo `pos_counter`, `POSWorkspace.tsx`), y todo el ingreso debe quedarse dentro de esta app.

El plan limpia ese legado, unifica el acceso al POS propio, y aprovecha el barrido para corregir deuda detectada (semillas demo, RLS de `user_roles`, edge functions con `verify_jwt`, telemetría de login).

---

## Hallazgos clave de la auditoría

```text
Síntoma observado:
  /clientes → tab "POS" → "Ingresar al POS" → window.open(softwarepos.online)

Causa raíz:
  src/modules/clientes/components/ClientPOSAccess.tsx:51
  src/modules/clientes/components/ClientPOSLogin.tsx:83
    form.action = "https://softwarepos.online/index.php/login/index/1"

Daño colateral:
  - Edge function `validate-pos-login` valida contra el sistema viejo
  - Tabla `client_pos_sessions` guarda credenciales del POS legado (texto/encriptado)
  - RPC `get_client_pos_sessions` expone esas filas
  - Tab "POS" en ClientPortal.tsx promueve el flujo legado
  - Console muestra "Role assignment failed: RLS user_roles" al crear usuarios desde admin
  - Edge functions de licencias ya quedaron arregladas (turno anterior)
  - Columnas faltantes en `client_tickets` ya quedaron arregladas (turno anterior)
```

---

## Fase 1 — Cortar el cordón con softwarepos.online (crítico, ~1 sesión)

**Resultado:** ningún botón de la app abre softwarepos.online. El tab "POS" del cliente lleva a `/pos` nativo.

1. Reemplazar `ClientPOSAccess.tsx`: eliminar el `submitPOSForm` que hace `form.action = softwarepos.online`; el botón "Ingresar al POS" debe usar `navigate("/pos")` (React Router) con verificación previa de:
   - sesión activa (`useAuth`)
   - organización activa (`useOrganization.currentOrg`)
   - módulo `pos_counter` activo (`hasModule("pos_counter")`)
2. Si falta organización o módulo, mostrar CTA: "Configura tu tienda" → `/onboarding?org=<id>` (ya implementado en post-license-onboarding).
3. Eliminar `ClientPOSLogin.tsx` (duplicado del flujo legado, sin usos críticos).
4. Marcar como deprecated y dejar de renderizar el tab "POS legado". Si el usuario aún lo necesita por compatibilidad, esconderlo tras feature flag `legacy_pos_bridge` (default OFF).
5. Eliminar/archivar la edge function `validate-pos-login` y el RPC `get_client_pos_sessions`. Conservar la tabla `client_pos_sessions` solo si hay registros activos; si está vacía, drop con migración.

**Verificación:** `rg "softwarepos\.online" src/` devuelve 0 coincidencias. Click en "Ingresar al POS" desde `/clientes` aterriza en `/pos` y abre `OpenSessionPanel`.

---

## Fase 2 — Sembrar tienda demo operativa (~1 sesión)

**Resultado:** la organización "demo" puede ejecutar todos los flujos (POS, KDS, impresión, tickets) sin configuración manual.

1. Migración `seed-demo-org.sql` que upsertea:
   - `organizations { slug: 'demo', name: 'Tienda Demo' }`
   - `organization_modules` con `pos_counter`, `pos_kds`, `pos_tables`, `printing`, `einvoice` activos
   - 1 `location` "Sede Principal" + 1 `cash_register` "Caja 1"
   - 1 `kitchen_station` "Cocina", 1 `dining_area` + 4 `dining_tables`
   - 10 `products` representativos con `product_presentations` base
   - vincular `demo@sistecpos.com` (user existente) como `organization_members` con rol `admin`
2. Asegurar que `handle_new_user` asigne automáticamente la organización demo cuando el dominio del email sea `@sistecpos.com` y no exista membresía.
3. Endpoint admin `/superadmin/reseed-demo` (botón) que invoca edge function `seed-demo-data` para resetear el tenant demo a estado limpio.

**Verificación:** login con `demo@sistecpos.com` → switch automático a org "demo" → `/pos` muestra catálogo, abre caja, crea ticket, imprime preview.

---

## Fase 3 — Endurecer flujo de login y RBAC (~1 sesión)

**Resultado:** sin warnings RLS al crear usuarios; rutas protegidas con guard único.

1. Arreglar RLS de `user_roles` (warning visto en consola: `new row violates RLS for table "user_roles"`). Política actual no permite que un admin asigne roles dentro de su org. Añadir policy `INSERT` `WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'))`.
2. Unificar guards: hoy conviven `RoleGuard`, `MasterOnlyGuard` y chequeos ad-hoc. Mantener `RoleGuard` (sección-driven) + `MasterOnlyGuard` (superadmin allowlist) y deprecar checks dispersos.
3. Quitar el chequeo de `hasModule("pos_counter")` duplicado en POS.tsx y centralizar en `RoleGuard module="pos_counter"`.
4. Agregar telemetría: cada login dispara `auth_login_events` con `{user_id, method, host, redirected_to}` para auditar a dónde aterrizan los usuarios.

**Verificación:** crear usuario desde `admin/users` sin warning RLS; tabla `auth_login_events` recibe filas.

---

## Fase 4 — Limpieza de edge functions y secretos (~0.5 sesión)

**Resultado:** ninguna función rota, importes consistentes, `verify_jwt` correcto.

1. Auditar todas las funciones bajo `supabase/functions/`:
   - Eliminar `validate-pos-login` (Fase 1 lo deja sin uso).
   - Verificar que ninguna otra siga importando `npm:@supabase/supabase-js@2/cors` (ya corregido en license-*).
   - Asegurar `verify_jwt` correcto en `config.toml` para funciones públicas (lead-capture, image-optimizer) vs autenticadas (license-*, auth-*).
2. Rotar `AUTH_ENCRYPTION_KEY` si nunca se generó (pre-condición del módulo auth).

**Verificación:** `curl` smoke test a cada edge function activa retorna 200/401 esperado.

---

## Fase 5 — Observabilidad y guardarraíles (~0.5 sesión)

**Resultado:** errores futuros visibles, regresiones imposibles a softwarepos.online.

1. Test e2e Playwright `e2e/pos-login.spec.ts`: login demo → /clientes → click POS → asertar `page.url()` contiene `/pos` y NO `softwarepos.online`.
2. ESLint rule custom (`no-restricted-syntax`) que prohíbe literales con `softwarepos.online` en `src/`.
3. Sentry/console wrapper para edge functions de auth con `console.error` estructurado.
4. Documentar todo en `mem://features/pos-native-login` y actualizar índice de memoria.

**Verificación:** `bun e2e` pasa la nueva spec; `bun lint` falla si alguien reintroduce la URL.

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Clientes con sesiones guardadas en `client_pos_sessions` activas | Banner one-time: "Tu acceso ahora está integrado. Vuelve a iniciar sesión en /pos." |
| `seed-demo-org.sql` pisa datos reales si demo se reutilizó | Usar `INSERT … ON CONFLICT DO NOTHING` y bandera `is_seed_demo=true` para identificar filas auto-generadas |
| RLS endurecido bloquea flujos legítimos | Probar con cada rol (superadmin/admin/editor/user) antes de hacer merge |

## Orden sugerido de ejecución

Fase 1 (bloqueante UX) → Fase 3 (RBAC) → Fase 2 (demo) → Fase 4 (cleanup) → Fase 5 (guardarraíles).

## Detalles técnicos

- **Stack tocado:** React Router (`navigate`), `useOrganization`, `useAuth`, Supabase RLS, edge functions Deno, Playwright.
- **Tablas afectadas:** `client_pos_sessions` (drop), `user_roles` (policy), `organizations`/`organization_members`/`organization_modules` (seed), `auth_login_events` (insert).
- **Archivos clave a modificar:** `ClientPOSAccess.tsx`, `ClientPOSLogin.tsx` (delete), `ClientPortal.tsx`, `RoleGuard.tsx`, `POS.tsx`, `supabase/functions/validate-pos-login/` (delete), `supabase/config.toml`.
- **Memorias a crear:** `mem://features/pos-native-login`, `mem://features/demo-tenant-seed`.

¿Apruebas el plan para empezar por la Fase 1?
