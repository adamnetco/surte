# POS — Actualizar Panel de Aprovisionamiento de Dominios

**Estado:** IN_REVIEW
**Módulo:** superadmin (Sitios → Detalles → Aprovisionamiento)
**Componente principal:** `src/modules/superadmin/components/SiteDetailsPanel.tsx`
**Fecha:** 2026-06-18

## 1. Problema

El panel "Aprovisionamiento" muestra información **falsa/contradictoria** para el flujo multi-tenant de SistecPOS:

- Etiqueta `Legacy [A directo]` y propone registros `A → 185.158.133.1` (IP del edge propio de un proyecto Lovable individual).
- Ese modo **no existe** en SistecPOS Core: la arquitectura es **Cloudflare for SaaS** (un único proyecto sirviendo muchos dominios de tenants vía CNAME al fallback hostname).
- El owner ve "A surteya.com → 185.158.133.1 ✅ detectado" + "HTTPS no responde" simultáneamente, sin entender que el A real lo deja fuera del enrutamiento por hostname de SistecPOS.
- El mensaje de error "Revisa que A apunte a 185.158.133.1" refuerza el camino incorrecto.

## 2. Caso de uso correcto (recordatorio arquitectónico)

1. Superadmin (o el owner desde su área) crea un `tenant_id` y recibe subdominio `tenant.sistecpos.com` automáticamente.
2. El owner opcionalmente conecta un **dominio propio** (`midominio.com`).
3. Backend llama a `cloudflare-domain-connect` → registra el hostname en CF for SaaS y devuelve:
   - `cname_target` (fallback hostname del SaaS, p. ej. `tenants.sistecpos.com`)
   - `ownership_verification` (TXT `_cf-custom-hostname`)
   - `ssl_validation_records` (TXT `_acme-challenge`)
   - Token `_lovable-tenant` para vincular el host a este tenant en SistecPOS.
4. Owner publica en su DNS: **CNAME root + 2 TXT** (3 registros, ningún `A`).
5. CF emite SSL → tráfico fluye al edge SaaS → SistecPOS resuelve `tenant_id` por hostname.

**No existe** un modo "A directo" válido. Si `cname_target` aún no está, el estado correcto es **"Sin registrar en Cloudflare"**, no "legacy".

## 3. Criterios de aceptación

- [ ] El badge `Legacy (A directo)` se elimina. Reemplazado por:
  - `Cloudflare SaaS (CNAME)` cuando hay `cname_target`.
  - `Sin registrar` cuando falta `cf_hostname_id` o `cname_target`.
- [ ] `buildDnsPlan` **nunca** genera filas de tipo `A` con `185.158.133.1`.
- [ ] Si `cname_target` está vacío, el checklist muestra una fila guía: *"Pulsa **Registrar en Cloudflare** para obtener el CNAME y los TXT"* (no obligatoria, no copiable).
- [ ] Cuando el SSL está activo pero HTTPS no responde, el mensaje dice: *"Revisa que el CNAME `host` apunte a `cname_target`"*. Nunca menciona `185.158.133.1`.
- [ ] Si el verificador detecta un `A` apuntando a `185.158.133.1` o cualquier IP fija, el sub-mensaje aclara: *"Detectamos un registro A directo. Para SistecPOS multi-tenant debes usar CNAME al hostname provisto. Cambia tu DNS."* (futuro — ver §5).
- [ ] La fila opcional `www` también es CNAME (nunca A).
- [ ] No quedan referencias a `LOVABLE_EDGE_IP` / `CF_EDGE_IP` en `SiteDetailsPanel.tsx`.

## 4. Cambios técnicos (este spec)

**Archivo:** `src/modules/superadmin/components/SiteDetailsPanel.tsx`

1. Eliminar `import { LOVABLE_EDGE_IP as CF_EDGE_IP }`.
2. `buildDnsPlan`:
   - Quitar la rama `else` que emite `A → CF_EDGE_IP`.
   - Si `!cnameTarget`: insertar fila guía `{ type: "CNAME", name: hostname, value: "— pendiente: registra en Cloudflare —", required: true, done: false, hint: "..." }`.
   - Fila `www` siempre CNAME (omitir si no hay `cname_target`).
3. Badge `Legacy (A directo)` → lógica nueva:
   - `cf_hostname_id && cname_target` → `Cloudflare SaaS (CNAME)`
   - else → `Sin registrar`
4. Mensaje de "HTTPS no responde": eliminar rama legacy.
5. Borrar variable `isSaas` (siempre asumida true).

## 5. Fuera de alcance (siguiente spec)

- Detección activa en `verify-tenant-domain` de un registro `A → 185.158.133.1` para emitir un warning explícito "DNS apunta a configuración legacy de Lovable, debes migrar a CNAME SaaS".
- Migración de tenants cuyos DNS sigan en A directo (script de auditoría + email al owner).

## 6. Riesgos

- Tenants antiguos creados antes de CF for SaaS quedarían "rotos" en el panel. **Mitigación:** la fila guía indica claramente la acción ("Registrar en Cloudflare"), y el botón ya existe.
