
# Plan: SaaS limpio — Login en `/`, Superadmin vs Workspace de Tienda

## Problema actual
Hoy `admin.sistecpos.com` mezcla en el mismo `AdminDashboard` tareas **multi-tenant** (Tiendas, Licencias, Sync, Fiscal global, Módulos) con tareas **operativas del negocio** (Inventario, Productos, CRM, POS). Esto confunde porque un dueño de tienda nunca debería ver "Organizaciones" ni "Sync Monitor", y el superadmin nunca debería tocar el inventario diario.

## Regla de oro
> Todo lo que sea **gestión multi-tenant** (alta de tiendas, licencias, módulos, fiscal global, sync, dominios) vive en el **Panel Superadmin**, oculto al resto.
> Todo lo que sea **operación de UN negocio** vive en el **Workspace de Tienda**, accesible solo a usuarios de esa tienda según su rol.

---

## 1. Login unificado en `/` (admin.sistecpos.com)

Reemplazar `LoginRouter` (las 2 cards) por **un único formulario tipo SaaS** con 3 campos:

```
┌─────────────────────────────┐
│  SistecPOS · Iniciar sesión │
├─────────────────────────────┤
│  Tienda (id_negocio)  [___] │  ← slug, ej: surteya
│  Usuario / Email      [___] │
│  Contraseña           [___] │
│  [ Entrar ]   ¿Olvidaste?   │
│  ─── o ───                  │
│  [  Continuar con Google ]  │
└─────────────────────────────┘
```

Tras login, el backend resuelve el rol efectivo del usuario en esa tienda y redirige:

| Rol detectado | Redirige a |
|---|---|
| `superadmin` (global, sin tienda obligatoria) | `/superadmin` |
| `owner` / `admin` de la tienda | `/t/:slug/admin` (Workspace config) |
| `manager` / `cashier` / `waiter` | `/t/:slug/pos` (POS directo) |
| `cliente` de la tienda | `/t/:slug/mi` (Portal cliente) |

El campo "Tienda" se autocompleta si entran por `surteya.sistecpos.com` (o `/surteya`) — solo lo escriben en el login genérico.

---

## 2. Dos paneles claramente separados

### A) `/superadmin` — Panel Superadmin (solo Eduardo / rol `superadmin`)
**Único lugar para tocar multi-tenancy.** Lo que hoy está disperso se consolida aquí:

- **Overview SaaS** — KPIs cross-tenant (ventas totales red, tiendas activas, licencias por vencer, errores sync).
- **Tiendas (Organizaciones)** — alta/baja, wizard de onboarding (paso 1 datos, paso 2 usuario owner + password inicial, paso 3 módulos activos, paso 4 dominio).
- **Licencias** — planes, vigencias, renovaciones.
- **Módulos por tienda** — toggles POS / Agenda / Inventario / Tienda online / Facturación / etc.
- **Fiscal global** — DIAN, resoluciones, configuración por tienda.
- **Monitor de Sincronización** — `sync_logs` global (WP, WhatsApp, DIAN).
- **Dominios & SSO** — verificación de subdominios y tokens SSO.
- **Usuarios globales** — buscar usuario, ver tiendas a las que pertenece, resetear password.

Otros roles **nunca** ven `/superadmin` (guard duro + RLS).

### B) `/t/:slug/admin` — Workspace operativo del negocio (estilo POS Colombia / Cabal)
Para `owner` / `admin` de UNA tienda. Layout inspirado en las capturas (top bar con módulos grandes + icon):

```
[Clientes] [Artículos] [Kits] [Proveedores] [Reportes] [Compras] [Ventas F2] [Listas Precios] [POS]
─────────────────────────────────────────────────────────────────────────────────────────────
              Bienvenido a {Nombre Tienda} — accesos rápidos del día
```

Tabs/secciones (solo las que el módulo está activo para esa tienda):
- Clientes (CRM local) · Productos · Categorías/Marcas · Kits · Proveedores · Compras · Listas de Precios · Reportes · Personalización tienda online · Empleados/roles internos · Configuración (logo, WhatsApp, horarios).

**NO aparecen** aquí: Tiendas, Licencias, Sync, Fiscal global, Módulos. Esos solo en `/superadmin`.

### C) `/t/:slug/pos` — POS Workspace (ya existe)
Para cajero/mesero. Sin cambios estructurales — solo se asegura el guard de tenant.

---

## 3. Onboarding del id_negocio (creado por superadmin)

Wizard en `/superadmin/tiendas/nueva` que en una sola transacción crea:

1. `organizations` (slug = id_negocio, nombre, NIT, ciudad).
2. Usuario `owner` en `auth.users` con email + **password inicial generado** (se muestra una sola vez + opción "enviar por email").
3. `user_roles` → owner de esa org.
4. `organization_modules` con los módulos seleccionados.
5. (Opcional) Subdominio `{slug}.sistecpos.com` en `tenant_domains`.
6. `einvoice_configs` placeholder.

Al terminar muestra tarjeta: **"Tienda creada · slug: surteya · usuario: admin@surteya.com · contraseña: ABC123"** lista para entregar al cliente.

---

## 4. Cambios técnicos (resumen para implementación)

```
src/pages/
  Login.tsx                    ← nuevo: form único (tienda + user + pass + Google)
  superadmin/
    SuperadminLayout.tsx       ← sidebar dedicado
    Overview.tsx
    Tiendas.tsx                ← mueve OrganizationsTab actual
    TiendaNueva.tsx            ← wizard onboarding
    Licencias.tsx              ← mueve de AdminDashboard
    Modulos.tsx
    Fiscal.tsx                 ← mueve FiscalSettingsTab
    Sync.tsx                   ← mueve SyncMonitor
    Dominios.tsx
  tienda/
    TiendaLayout.tsx           ← top bar estilo POS Colombia
    Inicio.tsx                 ← grid de módulos activos
    (Clientes, Productos, Reportes, etc. — reusan componentes existentes)

src/components/RoleGuard.tsx   ← endurecer: superadmin-only para /superadmin/*
src/App.tsx                    ← rutas /, /superadmin/*, /t/:slug/*
```

DB: ya existen `organizations`, `organization_modules`, `user_roles`, `einvoice_configs`, `sync_logs`. Solo hace falta:
- RPC `login_resolve(slug, email)` que devuelva tienda + rol efectivo para redirigir tras login.
- Trigger/función `create_tenant_with_owner(...)` para el wizard atómico.

---

## 5. Fases de entrega

1. **F1 — Login único** (`/` con 3 campos + Google) y redirección por rol/tenant.
2. **F2 — `/superadmin`** layout + mover Tiendas, Licencias, Módulos, Fiscal, Sync, Dominios desde `AdminDashboard`.
3. **F3 — Wizard "Nueva tienda"** atómico con password inicial.
4. **F4 — `/t/:slug/admin`** layout estilo POS Colombia con módulos del negocio.
5. **F5 — Limpieza** de `AdminDashboard` viejo + guards + QA con la tienda semilla `surteya`.

---

¿Apruebas el plan? Si sí, arranco por **F1 + F2** (login y separación de paneles) en este mismo turno.
