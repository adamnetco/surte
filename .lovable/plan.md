# Ola 18 — Dunning & Recuperación de pago

Objetivo: recuperar churn involuntario (tarjeta vencida, fondos insuficientes, fallo de gateway) con reintentos automáticos Wompi, escalado de comunicaciones, grace period, pausa automática y panel de morosidad para superadmin.

## Estado actual relevante
- Wompi ya emite webhooks (`wompi-events`) con estados APPROVED/DECLINED/ERROR/VOIDED para suscripciones y add-ons.
- `subscriptions` tiene `status` (active/past_due/canceled/...) y `current_period_end`.
- `subscription_invoices` ya existe con 22 columnas.
- `SubscriptionStatusBanner` y `SubscriptionGate` ya reaccionan a status `past_due`.
- Embudo Ola 17 (`gate_denials → upgrade_clicks → wompi_approved`) listo para enriquecer con eventos de dunning.

## Slices

### Slice 1 — Schema + detección de fallo (DB)
- Tabla `dunning_cases` (organization_id, subscription_id, invoice_id, status [open/recovered/written_off/paused], failure_reason, attempt_count, next_retry_at, opened_at, closed_at, total_amount_cop).
- Tabla `dunning_attempts` (case_id, attempt_no, scheduled_at, executed_at, outcome [approved/declined/error/skipped], wompi_transaction_id, error_code).
- RLS: admin/owner del tenant lee sus casos; superadmin lee todo; service_role escribe.
- RPC `dunning_open_case(p_subscription_id, p_invoice_id, p_reason)` — idempotente por (subscription_id, invoice_id).
- Trigger en `wompi-events`: cuando DECLINED/ERROR en cobro recurrente → abre caso + marca `subscription.status='past_due'`.
- Vista `v_dunning_summary` (por tenant y global) para KPIs.

### Slice 2 — Retry engine (Edge + cron)
- Edge function `dunning-retry-worker`: lee casos `open` con `next_retry_at <= now()`, ejecuta cobro Wompi (PSE/tarjeta tokenizada), registra attempt, calcula siguiente retry con backoff exponencial **D+1, D+3, D+5, D+7** (max 4 intentos). 
- En APPROVED → `recovered` + suscripción `active`; en último intento fallido → `paused` (suspende tenant) + status `canceled_for_nonpayment`.
- `pg_cron` cada 30 min invoca el worker.
- Telemetría: `usage_events` con `kind='dunning_attempt'`.

### Slice 3 — Comunicaciones escalonadas (emails + in-app)
- Plantillas React Email en `_shared/transactional-email-templates/`:
  - `dunning-payment-failed` (D+0): "No pudimos cobrar tu plan, lo reintentaremos automáticamente. Actualiza tu método si quieres adelantar."
  - `dunning-reminder` (D+3): "Segundo intento falló. Quedan 4 días de gracia."
  - `dunning-final-warning` (D+6): "Mañana suspenderemos tu cuenta."
  - `dunning-suspended` (D+7+): "Cuenta suspendida. Reactiva con un pago."
  - `dunning-recovered`: "¡Pago recuperado! Tu cuenta sigue activa."
- Triggers en `dunning-retry-worker` después de cada attempt.
- Banner `DunningBanner.tsx` global (ámbar→rojo según attempt_no) con CTA "Actualizar método de pago" → deep-link a `/billing/update-payment` con `return_to`.

### Slice 4 — Grace period + pausa automática + reactivación
- Config `grace_period_days` por plan (default 7) en `saas_plans.grace_period_days`.
- Durante grace: tenant lee/escribe normal, pero `SubscriptionGate` muestra DunningBanner crítico.
- Al expirar grace: `dunning-retry-worker` ejecuta `pause_tenant(org_id)` → cambia `organizations.status='suspended_payment'`, fuerza `TenantSuspendedBanner` ya existente.
- Página `/billing/recover`: muestra invoices vencidas, botón "Pagar y reactivar" → invoca `wompi-recover-payment` (nueva edge) → al APPROVED dispara `reactivate_tenant`.

### Slice 5 — Panel superadmin de morosidad + churn involuntario
- Página `/superadmin/dunning`:
  - KPI cards: casos abiertos, MRR en riesgo, tasa de recuperación 30d, churn involuntario evitado.
  - Tabla casos abiertos (tenant, días en mora, intentos, próximo retry, monto) con acciones: forzar retry ahora, marcar `written_off`, extender grace.
  - Gráfica recovery rate por cohorte semanal (Recharts).
- Integración con `ConversionFunnelPanel`: añadir métrica "churn recuperado" al embudo PLG.
- Export CSV de casos para finanzas.

## Skills aplicadas
- `saas-entitlements-and-plan-gating` — coordinación con SubscriptionGate ya existente.
- `saas-lifecycle-email-orchestration` — secuencia retention/dunning event-triggered, con suppression al recuperar.
- `saas-admin-backoffice-tooling` — panel superadmin con audit log y acciones co-firmadas (extender grace, write-off).
- `saas-business-metrics` — KPIs de involuntary churn y recovery rate.
- `feature-dev`, `frontend-design`, `code-review`, `claude-mem`.

## Orden de ejecución
Arranco con **Slice 1 (schema + apertura de caso)** ahora mismo si confirmas. ¿Procedo?
