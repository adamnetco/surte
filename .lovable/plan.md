# Plan: Backend documentado + Desarrollo local desacoplado

## Objetivo

Permitirte continuar el desarrollo de SURTÉ YA en local con otras IAs (Cursor, Claude Code, etc.), consumiendo la misma base de datos de Lovable Cloud vía una API REST clara y documentada en JSON.

## Entregables

### 1. Documentación de la API (`docs/api/`)

- `docs/api/README.md` — Introducción, URL base, autenticación, convenciones JSON, paginación, errores.
- `docs/api/auth.md` — Login, signup, OAuth Google, refresh token, recuperación de contraseña.
- `docs/api/tables.md` — Lista de las ~60 tablas (products, categories, orders, profiles, user_roles, etc.) con columnas, tipos y reglas RLS resumidas en lenguaje claro.
- `docs/api/rpc.md` — Documentación de las 35+ funciones RPC (`has_role`, `apply_stock_movement`, `validate_coupon`, `get_persistent_cart`, `register_activation`, etc.) con payload y respuesta JSON.
- `docs/api/edge-functions.md` — Las ~40 edge functions (ai-manager, cart-sync, sync-order, send-whatsapp-order, lead-capture, license-*, sitemap, etc.) con método, path, body y ejemplo `curl`.
- `docs/api/storage.md` — Buckets (`product-images`, `desktop-releases`, `invoices`), políticas de acceso, ejemplo de upload.
- `docs/api/realtime.md` — Canales activos (orders, persistent_carts, messages) y ejemplo de suscripción.
- `docs/api/examples/` — Ejemplos `curl` y JavaScript fetch para los flujos más comunes: listar productos, crear pedido, login, subir imagen.

### 2. Colección OpenAPI + Postman

- `docs/api/openapi.yaml` — Especificación OpenAPI 3.1 generada para los endpoints REST principales (REST autogenerado de PostgREST + edge functions).
- `docs/api/surteya.postman_collection.json` — Colección Postman importable con variables `{{base_url}}`, `{{anon_key}}`, `{{access_token}}`.

### 3. Setup de desarrollo local (`docs/local-dev.md`)

Guía para clonar y ejecutar el repo en tu máquina:

- Requisitos (Node 20+, bun o npm, git).
- `.env.local.example` con las variables públicas:
  - `VITE_SUPABASE_URL=https://dimyhjzcwlgfczimqhet.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=...` (anon key, pública)
  - `VITE_SUPABASE_PROJECT_ID=dimyhjzcwlgfczimqhet`
- Comandos: `bun install`, `bun dev`, `bun run build`.
- Cómo apuntar a Test vs Live.
- Cómo conectar Cursor / Claude Code al repo y consumir la API ya documentada.

### 4. Mapa de vistas separadas (`docs/views-map.md`)

Inventario claro de cada vista/página actual y para qué sirve, agrupadas por rol, para que puedas construirlas / iterarlas de forma aislada:

- **Público (storefront):** Index, Catalogo, Categorias, ProductoDetalle, Hub, Ofertas, Favoritos, Carrito, Pedido, LandingPage, MenuPage, Ayuda, Politicas.
- **Cuenta usuario:** Login, ResetPassword, Onboarding, Perfil, MisPedidos, Unsubscribe.
- **Admin / Backoffice:** AdminDashboard (+ tabs: Products, Orders, Inventory, Categories, Brands, Coupons, Users, Settings, SEO, Scripts, Notifications, etc.), AdminDiag, CatalogosBase, Configuracion, Sitios, Licencias, GerenteIA.
- **Operación / POS:** POS, KDS, Mesas, Inventario, Compras, Facturacion, Billing, Planes.

Para cada vista: ruta, componente, datos que consume (tabla/RPC/EF), rol requerido, dependencias de otros componentes. Esto te da un "tablero" para construir cada pantalla en local de forma independiente y conectarlas después sin sorpresas.

### 5. Cliente JS reutilizable fuera del repo (opcional pero recomendado)

- `docs/api/client-snippet.ts` — Snippet copy-paste de un mini-cliente que cualquier proyecto externo (otra app Vite/Next/Node script) puede usar para hablar con la misma base, basado en `@supabase/supabase-js` + la anon key.

## Lo que NO incluye este plan

- No modifica esquema de base de datos.
- No cambia código de la app actual (solo añade documentación y archivos `.md` / `.yaml` / `.json` bajo `docs/`).
- No expone claves privadas: solo se documenta la `anon key` (pública) y los flujos de auth para obtener `access_token` por usuario.

## Preguntas antes de implementar

1. ¿Quieres que la documentación esté en español (consistente con el proyecto) o bilingüe ES/EN?: Español
2. ¿Generamos también la colección Postman, o te basta con OpenAPI + ejemplos `curl`?: Si lo mas completo.
3. ¿Quieres que incluya un README específico para "cómo darle este repo a Cursor/Claude Code" con el prompt inicial recomendado?: Si.