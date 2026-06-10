---
name: Client Tickets - Mejoras pendientes
description: Tarea diferida para robustecer creación de tickets de soporte (logging detallado, validación cliente, adjuntos múltiples, notificación WhatsApp/email al staff)
type: feature
---

# Client Tickets — Tareas diferidas

Contexto: error "Error al crear ticket" en `/clientes` venía de columnas inexistentes (`whatsapp`, `video_url`, `attachment_url`) que el frontend enviaba a `client_tickets`. **Resuelto** añadiendo columnas en migración del 2026-06-10.

## Pendientes (priorizar cuando se aborde soporte multicanal)

1. **Logging detallado en `ClientTicketsTab.handleCreate`**: mostrar `error.message` en el toast (no solo "Error al crear ticket") para que el usuario reporte causa exacta.
2. **Validación Zod + react-hook-form** del formulario (subject min 5, description min 10, whatsapp formato CO).
3. **Adjuntos múltiples** usando la columna `attachments jsonb` (array de `{url, name, mime, size}`) en vez de un solo `attachment_url`.
4. **Notificación al staff** vía edge function al insertar ticket: email a soporte + WhatsApp template `nuevo_ticket_soporte`.
5. **Skeleton states** mientras carga el listado.
6. **Filtro por prioridad/módulo** en la lista del usuario.
7. **SLA visible** según `priority` (alta = 4h, normal = 24h, baja = 72h).
