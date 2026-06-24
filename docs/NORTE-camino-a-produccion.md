# SistecPOS Core — NORTE: Camino a Producción

**Fecha:** 2026-06-24
**Owner:** Eduardo Tobacia
**Estado:** Documento maestro vivo

> Tras meses de iteración (32+ etapas de refactor SaaS, 15 specs activos, ~50 archivos en `mem://`), el proyecto está **técnicamente sólido** pero **disperso en intención**. Este documento es la brújula: lo que falta, en qué orden, con qué criterio de "listo".

---

## 1. Diagnóstico honesto (dónde estamos hoy)

### ✅ Lo que YA está sólido (NO tocar más)
| Área | Estado |
|---|---|
| Multi-tenant aislamiento | 31 etapas de refactor cerradas, audit limpia (mem://features/saas-refactor-etapa15) |
| RLS + Grants + CSP enforcing | mem://features/saas-refactor-etapa25/28/29 |
| Onboarding tenant + provisión | RPC atómica + edge function idempotente (etapa 2) |
| Outbox + cola async | pgmq + sync-outbox |
| Welcome dispatcher + Resend | etapa 3 |
| Auditoría edge funcs cross-tenant | etapa 30 |
| Almacén productos / inventario / órdenes | DB + UI funcional |
| Catálogo ecommerce + storefront SurteYa | funcional en producción |
| WhatsApp YCloud + plantillas | integrado |
| POS básico + caja + turnos | funcional |
| Mesas + KDS + comandas | DB lista, UI básica |

### 🚧 Lo que está **a la mitad** (la causa de la sensación de "perder el norte")
| Área | % | Bloqueador real |
|---|---|---|
| Innapsis DIAN (FE) | ~40% | Falta UI config + emisión desde POS + retry/reintentos + PDF/XML descarga |
| Daily Driver UX (atajos, empty states, skeletons, Cmd+K, mobile) | ~30% | Spec abierto, 6 slices, solo 1-2 cerradas |
| Casas de Cambio (vertical FX) | ~10% | Spec hecho, sin código |
| Multi-ticket POS (gap vs Alegra) | 0% | Sin spec |
| HORECA polish (Vale Anulación, propinas contables) | ~50% | Vale anulación pendiente (decisión memoria) |
| Sub-mesas 15A/15B (gap vs VectorPOS) | 0% | Sin spec |

### ❌ Lo que NO debe entrar a v1 (matar la tentación)
- Sales-app móvil swipe (ya en memoria pero post-pilot)
- Pricing avanzado "preguntar por producto"
- Reputación con IA generativa
- Marketplace Rappi/Didi/iFood (Marketplace = ecommerce propio decidido)
- Onboarding gamificado / Cabal Academy estilo
- API pública con scopes (post-pilot)

---

## 2. La pregunta clave: ¿qué es "producción listo"?

**Producción no es "todo el roadmap". Producción es lo mínimo para cobrar a 3 tipos de tenant pago:**

| Tenant tipo | Necesidad mínima |
|---|---|
| **Retail / Mayorista (SurteYa-like)** | Ya funciona. Solo cerrar Innapsis FE para B2B grande |
| **HORECA / Restaurante pequeño** | POS+Mesas+KDS+Vale Anulación+Comandas impresas funcionando 8h sin caer |
| **Casa de Cambio (nuevo vertical)** | Slices 1-3 del spec (Schema+Config+POS FX). Cumplimiento UIAF puede ir en v1.1 |

**Outcome único de "producción listo":** 3 tenants pagando, ninguno escala tickets por bugs bloqueantes durante 14 días seguidos.

---

## 3. NORTE — Plan en 4 olas (12 semanas)

### Ola 1 — Cerrar Innapsis FE (semanas 1-3) → **DESBLOQUEA COBRO**
Sin FE no se factura legal en Colombia → no se cobra a B2B. Es el cuello de botella absoluto.

**Slices (en orden):**
1. UI configuración Innapsis (NIT + resolución + token) en `/admin/configuracion/facturacion-electronica` con test conexión
2. Botón "Emitir factura electrónica" en detalle de orden POS y ecommerce (toggle por org)
3. Retry exponencial + cola sync_outbox para fallos Innapsis
4. Descarga PDF + XML desde detalle de factura
5. Email automático cliente con PDF/XML adjunto (reutilizar Resend)
6. Reporte `/admin/facturas-electronicas` con filtros estado (emitidas / rechazadas / pendientes)
7. Modo contingencia DIAN (offline → cola → emisión al recuperar conexión, ya hay base)

**Criterio listo:** SurteYa emite 100 facturas reales sin intervención manual.

---

### Ola 2 — HORECA pre-pilot completo (semanas 3-6) → **DESBLOQUEA VERTICAL**
Memoria ya capturó todas las decisiones (Vale Anulación, propinas, multi-rol KDS, stacking impuestos). Falta ejecutar.

**Slices:**
1. **Vale de Anulación a cocina** (decisión #3 memoria) — al anular comanda, EF imprime ticket "ANULADO" en estación correspondiente
2. **KDS multi-rol device picker** (decisión #4) — checkboxes Caja+KDS al login dispositivo, persist en `device_settings.roles[]`
3. **Gestor avanzado de impuestos stacking** (decisión #7) — tablas `taxes` + `product_taxes` + UI drag-order + preview vivo
4. **Propinas contables** (insight Alegra) — cuenta contable asociada, % sugerido configurable
5. **Comandas por estación** con routing (carne→parrilla, bebidas→bar) — ya hay `kitchen_stations` + `printer_routing_rules`
6. **Auto-save en pantallas Config** (decisión #5) — hook `useAutoSaveConfig` + indicador "Guardado · hace 2s"

**Criterio listo:** 1 restaurante real opera 7 días con cero fallos de impresión y cero quejas de UX cocina.

---

### Ola 3 — Daily Driver UX + Multi-ticket (semanas 6-9) → **DESBLOQUEA RETENCIÓN**
Sin UX pulida los tenants prueban y se van. Aquí entra **el gap crítico vs Alegra**.

**Slices (priorizar):**
1. **Multi-ticket POS simultáneo** (gap #1 vs Alegra) — `useTicketStash` + `<TicketTabs>` footer + atajos Ctrl+T/W/1..9 + persistencia localStorage
2. **Modal `?` overlay atajos completos** (patrón Alegra) — F4/Alt+P/E/C/R/V/B/N + hints discretos en botones
3. **Sidebar admin agrupado por dominios** (patrón Cabal) — `<Collapsible>` por grupo POV / Backoffice / Org / Contabilidad
4. **`/mi-cuenta` con tabs unificadas** (patrón Cabal) — Perfil / Plan / Integraciones / API Key / Seguridad
5. **Header ticket consolidado** (patrón Alegra) — Lista precio | Numeración | Pago | Centro costo | Cliente en 1 línea
6. **Audit empty states + skeletons** (slice 3-4 del spec daily-driver)
7. **Cmd+K global** (slice 5 del spec daily-driver)
8. **Sheet "Ventas recientes" en POS** (patrón Alegra) — anular/devolver sin abandonar caja

**Criterio listo:** Cajero novato cobra primera venta < 30s sin tutorial. Cajero experto procesa 60 tickets/h con teclado.

---

### Ola 4 — Casas de Cambio MVP (semanas 9-12) → **DESBLOQUEA VERTICAL #2**
Solo slices 1-3 del spec. UIAF/ROS y reportería avanzada van a v1.1.

**Slices:**
1. Schema FX + módulo registry (slice 1 spec)
2. Configuración admin: monedas, tasas, spread (slice 2)
3. POS FX: compra/venta divisa, cálculo automático equivalencia COP (slice 3)
4. **NO**: caja multi-divisa, UIAF, audit inmutable (v1.1)

**Criterio listo:** 1 casa de cambio piloto opera 1 semana con 50+ transacciones.

---

## 4. Decisiones de scope (qué se queda fuera de v1)

| Feature | Decisión | Razón |
|---|---|---|
| Apple SSO | Fuera v1 | Google ya cubre |
| i18n EN | Fuera v1 | Mercado Colombia |
| Programa referidos 40% | Fuera v1 | No urgente |
| API Key pública | Fuera v1 | Post-pilot |
| Tutoriales YouTube embebidos | Fuera v1 | Link externo en help basta |
| Marketplace Rappi/Didi | Fuera v1 | Confirmado: Marketplace = ecommerce propio |
| Listas de precios "preguntar por producto" | Fuera v1 | Confirmado vs cliente↔lista |
| Sub-mesas 15A/15B | v1.1 | Diferenciador post-pilot |
| Ola.click style menú QR | Aprovechar ecommerce existente | Ya 70% hecho |
| Reputación IA generativa | Fuera v1 | Distracción |

---

## 5. Reglas de disciplina (anti-iteración perdida)

1. **WIP máximo = 1 ola activa.** No empezar Ola 2 hasta cerrar Ola 1.
2. **Un slice = un PR = un día.** Si toma más de 1 día, se subdivide.
3. **Cada slice tiene un criterio de "listo" verificable** (no "funcionando" — métrica concreta).
4. **No nuevos specs durante una ola activa.** Las ideas van a `docs/specs/POS-backlog-ideas.md`.
5. **Memoria es ley.** Las 7 decisiones del POS-architecture-answers son inmovibles para v1.
6. **Cada viernes, demo de 5 min** de lo que cerró en la semana.
7. **No tocar el refactor SaaS (etapa 1-31)**. Cerrado.

---

## 6. Métricas de "listo para producción"

| Métrica | Target v1 |
|---|---|
| Uptime últimos 30 días | > 99.5% |
| Tenants pagando activos | ≥ 3 (1 retail, 1 HORECA, 1 FX) |
| Bugs P0 abiertos | 0 |
| Tiempo login → primera venta | < 30s |
| Facturas DIAN rechazadas por sistema | < 1% |
| Latency P95 query crítica POS | < 300ms |
| Tickets soporte / tenant / semana | < 2 |

---

## 7. Backlog post-v1 (para no perderlas, no para hacer ahora)

- Sub-mesas 15A/15B
- Caja multi-divisa + UIAF (Casas de Cambio v1.1)
- Sales-app móvil swipe
- API pública con scopes + Webhooks
- Tutoriales YouTube embebidos
- Apple SSO + i18n EN
- Programa referidos
- Listas precios "preguntar por producto"
- Reputación con IA
- KDS color por tiempo + marcar item individual ready
- Configurador factura split-screen con preview vivo (idea VectorPOS)
- Bento dashboard estilo Tiendana
- Kanban toggle en `/admin/pedidos` (estilo Cabal)

---

## 8. Próxima acción concreta

**Esta semana:** abrir `/POS-spec POS-multi-ticket` y `/POS-spec POS-innapsis-emision-pos` (los 2 specs que faltan para arrancar Ola 1 y prep Ola 3).

**No tocar nada más hasta que estos 2 specs estén aprobados.**

---

## Apéndice — referencias clave en memoria

| Pregunta | Memoria |
|---|---|
| ¿Qué decidí sobre canales / impuestos / listas? | `mem://decisions/pos-architecture-answers` |
| ¿Qué aprendí de Alegra (competidor #1)? | `mem://references/alegra-pos-patterns` |
| ¿Qué aprendí de Cabal (panel limpio)? | `mem://references/cabal-app-patterns` |
| ¿Qué aprendí de VectorPOS (HORECA pro)? | `mem://references/vectorpos-ui-patterns` + `backoffice-flows` + `settings-kds` |
| ¿Qué aprendí de POSCOL (simplicidad)? | `mem://references/softwarepos-colombia-patterns` + `dashboard-pricelists` |
| ¿Qué aprendí de UltimatePOS (anti-patrón visual)? | `mem://references/ultimatepos-patterns` |
| ¿Cuál era el roadmap previo? | `mem://features/roadmap-q3-2026` + `docs/specs/POS-roadmap-q3-2026.md` |
