# API SURTÉ YA — Referencia general

Backend gestionado por **Lovable Cloud** (Supabase). La API es **REST + JSON** auto-generada por PostgREST sobre PostgreSQL, complementada con **Edge Functions** (Deno) para lógica de servidor, integraciones externas y webhooks.

Toda la plataforma se consume con el mismo cliente (`@supabase/supabase-js`) o con `fetch` directo a los endpoints HTTP.

---

## URL base

| Recurso | URL |
|---|---|
| REST (PostgREST) | `https://dimyhjzcwlgfczimqhet.supabase.co/rest/v1` |
| Auth | `https://dimyhjzcwlgfczimqhet.supabase.co/auth/v1` |
| Storage | `https://dimyhjzcwlgfczimqhet.supabase.co/storage/v1` |
| Realtime (WS) | `wss://dimyhjzcwlgfczimqhet.supabase.co/realtime/v1` |
| Edge Functions | `https://dimyhjzcwlgfczimqhet.supabase.co/functions/v1/<nombre>` |

**Project ID:** `dimyhjzcwlgfczimqhet`

---

## Autenticación

Todas las peticiones llevan **dos cabeceras** mínimas:

```http
apikey: <ANON_KEY>
Authorization: Bearer <ANON_KEY_O_ACCESS_TOKEN_DE_USUARIO>
```

- **`anon key` (pública):** sirve para endpoints públicos sujetos a las políticas RLS para `anon`. Se puede commitear al repo.
- **`access_token` de usuario:** se obtiene tras `POST /auth/v1/token?grant_type=password` o vía OAuth (Google). Se envía en `Authorization: Bearer ...` para actuar como ese usuario.

`anon key` actual (pública):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbXloanpjd2xnZmN6aW1xaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODk1OTcsImV4cCI6MjA4OTc2NTU5N30.L2ERMQCCHYuJ51lhVffJaKIXKaVbwF0uGvkf-HxS6BI
```

Detalle de auth → [`auth.md`](./auth.md).

---

## Convenciones JSON

- Todos los cuerpos de request/response son `application/json` UTF-8.
- Timestamps: ISO 8601 con zona (`2026-05-24T18:30:00.000Z`).
- IDs: UUID v4 (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
- Dinero: `numeric` en Pesos Colombianos (COP) sin decimales (`12500`).
- Booleans: `true` / `false`.
- Arrays vacíos: `[]` (no `null`).

### Filtros (PostgREST)

```
GET /rest/v1/products?is_active=eq.true&select=id,name,price&order=created_at.desc&limit=20
```

Operadores: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `is`, `cs` (contiene), `or=(...)`.

### Paginación

Con header `Range`:

```http
Range: 0-19
Prefer: count=exact
```

Devuelve `Content-Range: 0-19/123`.

### Códigos de error estándar

| Código | Significado |
|---|---|
| `200` / `201` | OK |
| `204` | OK sin contenido |
| `400` | JSON o filtro inválido |
| `401` | Falta `apikey` / `Authorization` |
| `403` | RLS bloqueó la operación |
| `404` | Recurso no existe (o RLS lo oculta) |
| `409` | Conflicto (constraint, unique) |
| `422` | Validación |
| `429` | Rate limit |
| `5xx` | Error interno |

Formato de error:

```json
{ "code": "PGRST116", "message": "...", "details": null, "hint": null }
```

---

## Índice

- [`auth.md`](./auth.md) — Login, signup, OAuth Google, recovery.
- [`tables.md`](./tables.md) — Tablas, columnas y RLS.
- [`rpc.md`](./rpc.md) — Funciones RPC.
- [`edge-functions.md`](./edge-functions.md) — Endpoints de Edge Functions.
- [`storage.md`](./storage.md) — Buckets y archivos.
- [`realtime.md`](./realtime.md) — Suscripciones Realtime.
- [`openapi.yaml`](./openapi.yaml) — OpenAPI 3.1.
- [`surteya.postman_collection.json`](./surteya.postman_collection.json) — Colección Postman.
- [`client-snippet.ts`](./client-snippet.ts) — Mini cliente JS reutilizable.
- [`examples/`](./examples/) — Ejemplos `curl` y `fetch`.
- [`../local-dev.md`](../local-dev.md) — Setup en tu máquina.
- [`../views-map.md`](../views-map.md) — Mapa de vistas de la app.
- [`../cursor-handoff.md`](../cursor-handoff.md) — Cómo entregar este repo a Cursor / Claude Code.
