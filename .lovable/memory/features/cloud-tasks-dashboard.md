---
name: Cloud Tasks Dashboard
description: Panel Superadmin que rastrea migraciones/seeds/secrets/edge fns pendientes en Test y Live con historial y reintentos
type: feature
---

Ubicación: `/superadmin/cloud-tareas` (route en `SuperadminDashboard.tsx`, link en `SuperadminSidebar.tsx`).

Arquitectura:
- `src/modules/superadmin/lib/cloudTasks.ts` — registry estático `CLOUD_TASKS[]` con checkers por entorno (test/live) y helpers de historial en localStorage (`sistecpos:cloud-tasks:history:v1`, máx 200).
- `src/modules/superadmin/pages/CloudTasksStatus.tsx` — UI con resumen de estados, lista por tarea con badges Test/Live, botón reintentar por tarea+entorno, historial limpiable.

Checkers disponibles: `checkColumnExists`, `checkTableExists`, `checkOrgExists`, `checkEdgeFunction` (OPTIONS preflight). Live queda en "unknown" mientras no exista cliente Supabase Live separado — se valida tras publicar (publish sincroniza esquema y edge fns, no datos).

Para añadir una nueva tarea pendiente: push a `CLOUD_TASKS` con `id`, `group`, `title`, `check(env)`. La fuente de verdad de SQL/instrucciones sigue siendo `.lovable/pending-cloud-tasks.md` (campo `reference`).
