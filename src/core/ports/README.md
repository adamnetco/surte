# Ports (Contratos)

Interfaces que la capa `core/` expone al mundo. Las implementaciones concretas
viven en `src/infrastructure/` (Supabase, WebUSB, Innapsis, WhatsApp…).

**Regla dura:** `presentation/` nunca importa desde `infrastructure/`; sólo
consume ports + use-cases. La composición se resuelve en `src/main.tsx`.

Fases próximas del plan (`.lovable/plan.md`):

- Fase 2 — `ICartRepository`, `IProductRepository`, `IPosSessionRepository`,
  `IInvoiceGateway`, `IMessagingGateway`, `IHardwareService`.
