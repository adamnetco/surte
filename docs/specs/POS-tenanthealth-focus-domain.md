# POS-tenanthealth-focus-domain

**Estado:** IN_BUILD
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
- [ ] AC1: Click en "Activar SSL" desde TenantHealth abre `/sitios?tab=domains&focus=<id>`.
- [ ] AC2: La fila/card del dominio queda visible en viewport sin scroll manual.
- [ ] AC3: El panel de detalles se abre automáticamente si el `focus` está en un Collapsible cerrado.
- [ ] AC4: Anillo de foco visible 2s y luego desaparece (sin layout shift permanente).
- [ ] AC5: Si el dominio enlazado fue eliminado, la URL no rompe (fallback silencioso al tab sin focus).
- [ ] AC6: TenantHealth elige el dominio "más crítico" según prioridad SSL failed > DNS error > pendiente.

## Archivos a tocar
- `src/modules/superadmin/components/TenantHealth.tsx`
- `src/modules/superadmin/pages/SitiosTenantRoute.tsx`
- `src/modules/superadmin/pages/Sitios.tsx`
- `src/modules/superadmin/components/SiteDetailsPanel.tsx`

## Notas
Pendiente de definir: ¿el foco debe ser por `tenant_domains.id` o por `hostname`? El `id` es más robusto pero menos legible en la URL.
