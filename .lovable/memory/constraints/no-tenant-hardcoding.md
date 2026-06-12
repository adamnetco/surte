---
name: No tenant hardcoding in core
description: El core no debe contener literales atados a un tenant; valores específicos viven en organizations/app_settings/tenant_domains
type: constraint
---
Nada específico de un tenant vive en código del core. Prohibidos como literales:
`SurteYa`, `surteya`, `Bucaramanga`, `Santander`, `Cárnicos`, `Pulpas`, `Panificados`,
números `+573…` específicos, dominios `surteya.com`, etc.

**Cómo aplicar:**
- Branding, copy, ciudad, contacto → leer de `organizations` + `app_settings` (claves: `store_name`, `seo_locality`, `hero_title_*`, `whatsapp_phone`, etc.).
- Dominios → `tenant_domains` resueltos por `resolve-tenant` edge function.
- Logos → `organizations.logo_url` (placeholder neutro si null).
- Categorías → tabla `categories` con `icon` (lucide o SVG) por tenant.

**Guardas activas:**
- ESLint rule en `eslint.config.js` (`no-restricted-syntax` con regex `\b(SurteYa|surteya|Bucaramanga|...)\b`) — falla `npm run lint`.
- `scripts/audit-hardcoding.ts` con baseline numérico — falla `npm run audit:hardcoding` si sube.

**Excepciones permitidas:**
- `SurteyaRedirect.tsx`, `legacyDomains.ts` — adaptador para dominio legacy.
- `cloudTasks.ts` — tarea superadmin de registro inicial.
- `supabase/seeds/seed_surteya_org.sql` — seed tenant-específico aislado.
- Scaffolds Lovable de email-domain (`auth-email-hook`, `send-transactional-email`, etc.).
- Tests (`*.test.ts(x)`).

**Por qué:** SistecPOS es multi-tenant. Cualquier literal hardcodeado rompe el aislamiento y obliga a forkear el código para cada cliente nuevo.
