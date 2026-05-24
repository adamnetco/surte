# Desarrollo local

Guía para clonar este repo, ejecutarlo en tu máquina y conectarte a la **misma base de datos** que ya tiene la app en Lovable Cloud — sin romper nada de lo que está en producción.

---

## 1. Requisitos

- **Node.js 20+** (recomendado 20 LTS o superior).
- **bun** (rápido) o **npm/pnpm**. La app está optimizada para bun.
- **git**.
- Editor: VS Code, Cursor, o Claude Code.

```bash
node -v   # >= 20
bun -v    # opcional pero recomendado
```

---

## 2. Clonar y dependencias

El repo se sincroniza automáticamente al GitHub configurado en Lovable. Para clonar:

```bash
git clone <url-de-tu-repo-github>.git surteya
cd surteya
bun install        # o: npm install
```

---

## 3. Variables de entorno

Crea `.env.local` en la raíz (basado en `.env.local.example`, ver siguiente sección):

```env
VITE_SUPABASE_URL=https://dimyhjzcwlgfczimqhet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbXloanpjd2xnZmN6aW1xaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODk1OTcsImV4cCI6MjA4OTc2NTU5N30.L2ERMQCCHYuJ51lhVffJaKIXKaVbwF0uGvkf-HxS6BI
VITE_SUPABASE_PROJECT_ID=dimyhjzcwlgfczimqhet
```

> El archivo `.env` que ya existe en el repo es **gestionado automáticamente por Lovable** — no lo edites manualmente. Usa `.env.local` para tu trabajo local; Vite lo prioriza.

### Test vs Live

- Las variables anteriores apuntan al **proyecto de Lovable Cloud actual** (mismo que ve la app publicada).
- Si quieres separar **Test** y **Live**, abre Lovable → Connectors → Lovable Cloud y cambia entre entornos; cada uno tiene su URL y key.

---

## 4. Comandos

```bash
bun dev               # arranca Vite en http://localhost:8080
bun run build         # build producción a dist/
bun run preview       # sirve dist/
bunx vitest run       # tests
```

---

## 5. Estructura mínima que tienes que entender

```
src/
  pages/              # cada ruta (Index, Catalogo, Login, AdminDashboard, ...)
  components/         # UI compartida; subcarpetas surte/, admin/, pos/, ui/
  context/            # AuthContext, CartContext, OrganizationContext, ThemeContext
  hooks/              # useStore, useFavorites, useProfile, ...
  integrations/
    supabase/client.ts   # ¡NO EDITAR! cliente auto-generado
    supabase/types.ts    # ¡NO EDITAR! tipos auto-generados (es tu fuente de verdad de columnas)
    lovable/index.ts     # wrapper de Lovable Cloud Auth (Google)
  lib/                # utilidades (cart, whatsapp, offline, pushClient)
supabase/
  functions/          # Edge Functions (Deno)
  migrations/         # historial de SQL aplicado
docs/
  api/                # documentación REST + RPC + Edge Functions + OpenAPI + Postman
  local-dev.md        # ← este archivo
  views-map.md        # mapa de vistas
  cursor-handoff.md   # cómo entregar a Cursor / Claude Code
```

---

## 6. Hacer cambios sin romper Lovable Cloud

- Crear nuevas migraciones SQL en local: añadirlas a `supabase/migrations/`. Cuando hagas push, Lovable las detecta. Para aplicarlas tienes dos caminos:
  1. **Recomendado**: pedirle a Lovable que las aplique (la herramienta `supabase--migration` corre el SQL en Test y luego, al publicar, en Live).
  2. **Manual**: usar Supabase CLI apuntando al proyecto. Necesitas el `SUPABASE_DB_URL` (lo da Lovable Cloud).
- Editar Edge Functions: tras `git push`, Lovable las redeplaya automáticamente.
- **Nunca** edites: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `src/integrations/lovable/index.ts`, `.env`. Son regenerados.

---

## 7. Cómo probar la API en frío

```bash
export URL=https://dimyhjzcwlgfczimqhet.supabase.co
export ANON_KEY="$(grep VITE_SUPABASE_PUBLISHABLE_KEY .env.local | cut -d= -f2-)"

curl -s "$URL/rest/v1/products?is_active=eq.true&limit=3&select=id,name,price" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | jq
```

Más ejemplos en [`docs/api/examples/curl.sh`](./api/examples/curl.sh) y la colección Postman [`docs/api/surteya.postman_collection.json`](./api/surteya.postman_collection.json).

---

## 8. Trabajar con otra IA (Cursor, Claude Code, Codex)

Ver [`docs/cursor-handoff.md`](./cursor-handoff.md). En resumen:

1. Abre el repo en Cursor/Claude Code.
2. Asegúrate de tener `.env.local` con las 3 variables `VITE_SUPABASE_*`.
3. Lee primero `docs/api/README.md` y `docs/views-map.md`.
4. Pídele a la IA: "construye la vista X consumiendo los endpoints documentados en `docs/api/`".
