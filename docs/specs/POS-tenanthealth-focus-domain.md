# POS-tenanthealth-focus-domain

**Estado:** SHIPPED
**Módulo:** superadmin / TenantHealth + Sitios
**Owner:** Eduardo

## Problema
TenantHealth ya hace deep-link al tab correcto (`?tab=domains`), pero cuando un tenant tiene varios dominios y uno está fallando (SSL `failed`, DNS `pending`, verificación SistecPOS pendiente), el admin entra a `/sitios?tab=domains` y tiene que scrollear/buscar manualmente el dominio problemático.

Queremos que el CTA "Activar SSL" / "Dominios pendientes" lleve directo al panel del dominio fallando, ya expandido y con foco.

## Diseño
1. **TenantHealth**: cuando detecte dominios con problema, el link incluye `#domain-<id>` o `?focus=<id>`.
2. **SitiosTenantRoute / Sitios.tsx**: leer el query param `focus` y propagarlo a `SitesTab` / `DomainsTab`.
3. **SiteDetailsPanel.tsx**:
   - Aceptar prop `defaultOpen` y abrir automáticamente el Collapsible / Sheet si su domain `id` coincide con `focus`.
   - Hacer `scrollIntoView({ block: "center" })` + foco visual (ring temporal 2s) usando `useEffect`.
4. **DomainsTab**: marcar la fila correspondiente con `data-focus` y aplicar `scrollIntoView`.
5. Si hay varios dominios con problema, TenantHealth muestra el más crítico (SSL failed > DNS error > verificación pendiente) y enlaza a ese.

## Criterios de Aceptación
- [x] AC1: Check "Dominios y SSL" en TenantHealth genera `to: /sitios?tab=domains&focus=<id>` cuando hay dominio crítico.
- [x] AC2: `DomainsTab` hace `scrollIntoView({ block: "center", behavior: "smooth" })` sobre la fila con `data-focus-id=<id>`.
- [x] AC3: Aplica clase `ring-2 ring-primary ring-offset-2 bg-primary/5` a la fila objetivo. (El detalle por dominio vive en la tabla; el `SiteDetailsPanel` queda fuera de scope porque es per-site, no per-domain.)
- [x] AC4: Anillo de foco se quita a los 2.2s vía `setTimeout` + `setFocusActive(null)`; sin layout shift permanente.
- [x] AC5: Si el `focus` no existe en `domains` cargados, se limpia silenciosamente y no rompe (fallback al tab sin focus).
- [x] AC6: TenantHealth elige el más crítico con prioridad `cf_ssl_status === "failed"` > `!verified_at` > `cf_ssl_status !== "active"` > primero.

## Archivos tocados
- `src/modules/superadmin/components/TenantHealth.tsx` — cálculo de `criticalDomain` + `domainsHref`.
- `src/modules/superadmin/pages/SitiosTenantRoute.tsx` — lee `?focus` y lo propaga.
- `src/modules/superadmin/pages/Sitios.tsx` — prop `initialFocus` → `DomainsTab.focusDomainId`; efecto scroll + ring 2.2s + `data-focus-id`.

## Notas
- Foco por `tenant_domains.id` (UUID), más robusto y estable que por hostname.
- Spec próximo opcional: extender `SiteDetailsPanel` para auto-abrir su Collapsible cuando el `focus` pertenece a un dominio del sitio (útil cuando se entre desde `?tab=sites&focus=<id>`).
