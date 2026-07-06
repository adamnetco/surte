# src/infrastructure — Adaptadores Técnicos

Implementaciones concretas de los `ports` definidos en `src/core/ports/`.
La capa `presentation/` **nunca** importa desde aquí; la composición
(qué adapter usar) se resuelve en `src/main.tsx` o mediante hooks
selectores.

- `database/` — Supabase repos.
- `messaging/` — WhatsApp, SMS.
- `hardware/` — WebUSB / WebSerial (Fase futura).
- `invoicing/` — Innapsis DIAN (Fase futura).
