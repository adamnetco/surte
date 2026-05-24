# Entregar este repo a Cursor / Claude Code / Codex

Esta guía explica cómo dar continuidad al desarrollo de SURTÉ YA en local con otra IA, **sin perder contexto** y sin que toque cosas críticas.

---

## 1. Setup mínimo

1. Clona el repo y entra:
   ```bash
   git clone <tu-repo>.git surteya && cd surteya
   bun install
   ```
2. Copia `.env.local.example` → `.env.local`.
3. Abre la carpeta con Cursor / Claude Code.

---

## 2. Prompt inicial recomendado

Pega esto literal como **system / project prompt** la primera vez:

```text
Eres un Senior Software Engineer trabajando en SURTÉ YA, una PWA de e-commerce B2B/B2C
construida con React + Vite + Tailwind + Supabase (Lovable Cloud).

REGLAS DURAS:
1. La fuente de verdad de la API está en `docs/api/`. Léela antes de proponer cualquier
   endpoint. Especificación OpenAPI: `docs/api/openapi.yaml`. Postman:
   `docs/api/surteya.postman_collection.json`.
2. El mapa de vistas está en `docs/views-map.md`. Úsalo para saber qué tablas/RPCs/Edge
   Functions consume cada pantalla.
3. NUNCA edites: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`,
   `src/integrations/lovable/index.ts`, `.env`. Son regenerados por Lovable.
4. NUNCA hardcodees colores; usa los tokens semánticos de `src/index.css` / `tailwind.config.ts`
   (Primary #0C4B83, Success #76B833, Accent #F37021).
5. Mobile-first estricto a 390px. Desktop: `max-w-7xl mx-auto`.
6. WhatsApp: solo texto plano + dashes/colons, NUNCA emojis.
7. Roles: superadmin > admin > editor > agente > user. Usa el RPC `has_role` o el
   componente `RoleGuard` para proteger rutas.
8. Para CUALQUIER cambio de schema (tablas, RLS, funciones, triggers) debes generar
   un archivo nuevo en `supabase/migrations/` con timestamp y describir el cambio. NO
   apliques tú directamente migraciones contra producción.
9. El usuario maestro inmutable es `eduardotp77@gmail.com` (superadmin, protegido por
   trigger `prevent_master_superadmin_demotion`).
10. Cada feature nueva debe seguir el patrón "vista aislada → hook de datos → conexión".
    Empieza con datos mock, luego conecta el hook a Supabase.

STACK:
- UI: shadcn/ui + Tailwind, lucide-react para iconos
- Estado: React Query (@tanstack/react-query) ya configurado
- Auth: `@/integrations/lovable` (Google) + `@/integrations/supabase/client` (email/pw)
- Realtime: `supabase.channel(...).on("postgres_changes", ...)`

Tu primer paso siempre es:
1. Leer `docs/api/README.md`
2. Leer `docs/views-map.md`
3. Confirmar qué vista vas a tocar y qué endpoints existirán.
```

---

## 3. Flujo recomendado por feature

1. **Plan:** la IA describe en 1 párrafo qué hace, qué endpoints usa, qué tabla(s) toca.
2. **Vista aislada:** crea/edita `src/pages/<NuevaVista>.tsx` con datos mock.
3. **Hook:** crea `src/hooks/use<Cosa>.ts` que use el cliente Supabase. Copia patrón de `src/hooks/useStore.ts`.
4. **Conexión:** reemplaza el mock por el hook.
5. **Permisos:** envuelve la ruta en `RoleGuard` si aplica.
6. **Realtime (opcional):** suscríbete con `supabase.channel(...)`.

---

## 4. Cómo NO romper Lovable Cloud

- **Migraciones SQL:** generar archivo en `supabase/migrations/<timestamp>_descripcion.sql`. Cuando hagas push, Lovable detecta el archivo y te pedirá aplicarlo (o lo aplicas con Supabase CLI apuntando al proyecto). En ningún caso ejecutes `DROP` sin pasar antes por el flujo descrito en `safe-database-migrations`.
- **Edge functions:** edítalas en `supabase/functions/<nombre>/index.ts`. Tras push, Lovable las redeplaya.
- **RLS:** cualquier tabla nueva DEBE llevar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + políticas. Patrón base en `docs/api/tables.md`.

---

## 5. Probar la API offline

```bash
export URL=https://dimyhjzcwlgfczimqhet.supabase.co
export ANON_KEY=$(grep VITE_SUPABASE_PUBLISHABLE_KEY .env.local | cut -d= -f2-)
bash docs/api/examples/curl.sh
```

O importa `docs/api/surteya.postman_collection.json` en Postman / Insomnia / Bruno.

---

## 6. Checklist antes de hacer push

- [ ] `bun run build` pasa sin errores.
- [ ] No tocaste archivos prohibidos (`client.ts`, `types.ts`, `lovable/index.ts`, `.env`).
- [ ] Si hay nueva tabla → migración con RLS.
- [ ] Si hay nuevo endpoint → documentado en `docs/api/`.
- [ ] Si hay nueva vista → entrada en `docs/views-map.md`.
- [ ] Probado a 390px (mobile-first) y a 1280px (desktop).
