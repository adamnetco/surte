# Ola 6 — Slice D: Lock-screen PIN

Componente `src/components/PinLock.tsx` montado global en `App.tsx`.

- PIN 4-6 dígitos, hash SHA-256 en `localStorage` con key `pos:pin:${user.id}`.
- Auto-lock por inactividad (15 min) solo en rutas `/admin`, `/pos`, `/superadmin` y si el usuario ya configuró PIN.
- Eventos: `pin-lock:lock` (bloquear ya), `pin-lock:setup` (forzar configuración), `pin-lock:clear` (borrar).
- Keypad táctil + soporte teclado (0-9, Backspace, Enter); auto-submit al llenar 6 dígitos.
- "Restablecer PIN" disponible en pantalla de verificación (confirm + clear).
- `QuickActionsFAB` añade acción "Bloquear pantalla" / "Configurar PIN" en contexto admin.
