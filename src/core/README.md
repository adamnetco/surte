# src/core — El Cerebro

TypeScript puro. **0 % React · 0 % Supabase · 0 % UI.**

- `domain/entities/` — modelos de negocio (Cart, Product, Ticket, PosSession…).
- `domain/value-objects/` — estructuras inmutables (Money, Tax, Discount).
- `use-cases/` — orquestadores de acción, funciones puras testables.
- `ports/` — interfaces que la infraestructura debe implementar.

Consultar `.lovable/plan.md` (Auditoría + Plan de Refactor a Arquitectura Hexagonal).
