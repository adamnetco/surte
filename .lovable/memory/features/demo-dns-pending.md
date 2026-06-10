---
name: Demo DNS Pending Action
description: Cliente debe publicar TXT _acme-challenge y A records 185.158.133.1 para demo.sistecpos.com
type: feature
---

**Acción pendiente del cliente (demo.sistecpos.com):**

1. Publicar en su DNS los **dos TXT `_acme-challenge.demo.sistecpos.com`** que arrojó la reprovisión (visibles en `SiteDetailsPanel` → "Reprovisionar").
2. Publicar los **A records** apuntando a `185.158.133.1`:
   - `A demo → 185.158.133.1`
   - (si aplica) `A www.demo → 185.158.133.1`

**Seguimiento (efectuado / pendiente):**
- Registrado como tarea en el dashboard `/superadmin/cloud-tareas` con id `domain-demo-dns-acme`.
- Checker: consulta `tenant_domains` filtrando `hostname='demo.sistecpos.com'` y marca **done** cuando `cf_ssl_status = 'active'`. Mientras tanto queda **pending**.
- Verificación manual rápida: `dig TXT _acme-challenge.demo.sistecpos.com +short` y `dig A demo.sistecpos.com +short`.

Origen: reprovisión Cloudflare ejecutada 2026-06-10 desde `cloudflare-domain-reprovision`.
