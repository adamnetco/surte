# Deuda Técnica: Detección de registro A legacy activo

**ID:** POS-detectar-a-legacy  
**Spec relacionada:** POS-actualizar-panel-aprovisionamiento-dominios  
**Estado:** Abierta  
**Criterio afectado:** AC5 — Detección A activa  
**Prioridad:** Media  
**Severidad:** Baja–Media  

## Contexto

Durante la revisión de `POS-actualizar-panel-aprovisionamiento-dominios` se validaron 6 de 7 criterios de aceptación. El AC5 (“Detección A activa”) quedó fuera del alcance de ese spec porque requiere infraestructura adicional que no estaba planificada en el sprint: una función de borde que inspeccione DNS, persistencia de resultados y un cambio en el panel de admin.

## Qué se dejó pendiente

El panel de dominios no detecta automáticamente si un dominio aún tiene un registro A apuntando a la IP legacy (`185.158.133.1`). Esto impide:

- Mostrar un aviso visual cuando un dominio tiene configuración DNS obsoleta.
- Sugerir al usuario la corrección exacta (eliminar A y crear CNAME a Cloudflare).
- Prevenir conexiones fallidas o sin certificado por configura mezclada.

## Solución propuesta (tres capas)

1. **Nueva edge function `dns-inspect`**
   - Usar DoH (`cloudflare-dns.com/dns-query`) para consultar A y CNAME de un dominio.
   - Retornar: `{ aRecords, hasLegacyA, hasAnyA, cnameTarget }`.
   - Soportar reintentos simples y rate-limit básico.

2. **Persistir resultado en `tenant_domains`**
   - Migración con columnas:
     - `last_dns_check_at timestamptz`
     - `legacy_a_detected boolean`
     - `detected_a_records text[]`
   - Actualizar el registro cada vez que se ejecute la función.

3. **UI en `SiteDetailsPanel.tsx`**
   - Badge rojo: “Registro A legacy detectado” cuando `legacy_a_detected = true`.
   - Alerta con CTA: “Eliminar A y crear CNAME”.
   - Mostrar la lista de A records detectados en el panel de detalles.

## Criterios de aceptación futuros

- [ ] El sistema puede detectar si un dominio tiene un registro A apuntando a `185.158.133.1`.
- [ ] El resultado se almacena en `tenant_domains` y se muestra en el panel de detalles.
- [ ] Si se detecta un A legacy, se muestra un badge rojo y una alerta con acción correctiva.
- [ ] La función de detección no genera costos innecesarios (caché de 1 h, reintentos limitados).

## Riesgos de no resolver ahora

- Un usuario puede mantener DNS incorrecto sin darse cuenta, afectando HTTPS y disponibilidad.
- El soporte técnico debe diagnosticar manualmente cada caso de dominio fallido.
- La migración masiva de clientes legacy a SaaS requiere intervención manual.

## Estimación de esfuerzo

- Edge function + DoH: 1 día
- Migración + RLS + triggers: 0.5 días
- UI + badges + alerta: 1 día
- Pruebas + edge cases: 0.5 días
- **Total aproximado:** 3 días de trabajo efectivo.

## Notas adicionales

- Considerar ejecutar la función periódicamente (cron) o al abrir el panel de detalles del dominio.
- La detección de DNS puede ser cacheada por TTL real del registro; no confundir el usuario si el cambio ya se hizo pero aún no se propaga.
- Documentar la solución en el spec técnico si se prioriza en el siguiente sprint.
