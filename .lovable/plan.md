## Diagnóstico encontrado

- El backend está activo y saludable.
- El usuario `eduardotp77@gmail.com` existe, está confirmado, no está bloqueado y tiene rol `superadmin`.
- La sesión sí existe en el navegador: hay refresh exitoso para ese usuario y el token pertenece a `eduardotp77@gmail.com`.
- El bloqueo más probable ya no es la cuenta ni el rol, sino la UX/routing del login:
  - El login navega por defecto a `/` cuando no recibe `location.state.from`, por eso después de autenticarse puede parecer que “no ingresó” al software/admin.
  - El botón de Google deja estado “Conectando...” en casos de redirect/iframe porque no hay una pantalla clara de retorno ni verificación posterior de sesión.
  - `/admin` depende de `RoleGuard`, pero la configuración `admin_section_access` está vacía; usa fallback, pero conviene dejar diagnóstico explícito y una ruta maestra más directa.
  - El login mezcla registro, login, Google y recuperación en una UI básica, sin estados claros para “sesión detectada”, “redirigiendo” o “acceso admin”.

## Plan de implementación

1. **Corregir el flujo de ingreso maestro**
   - Cambiar el destino por defecto del login a `/admin` cuando el correo sea `eduardotp77@gmail.com` o cuando el rol detectado sea `superadmin/admin`.
   - Después de login email/password, esperar a que la sesión quede disponible antes de navegar.
   - Si el usuario ya tiene sesión activa al abrir `/login`, redirigirlo automáticamente a `/admin` si es admin/superadmin.

2. **Arreglar Google login sin quedarse en “Conectando...”**
   - Simplificar el flujo OAuth con `lovable.auth.signInWithOAuth("google")` y mantener `/~oauth` fuera del service worker.
   - Añadir recuperación de estado al volver del OAuth: detectar sesión activa y navegar correctamente.
   - Agregar timeout con acción clara: botón “Reintentar” y botón “Abrir en pestaña nueva”, no solo toast.

3. **Mejorar UX/UI completa del login**
   - Rediseñar pantalla mobile-first con estética SURTÉ YA/SistecPOS: panel limpio, logo, título claro, acceso maestro/admin visible, estados de carga profesionales.
   - Usar componentes existentes (`Input`, `Label`, botones semánticos) y tokens de diseño; sin colores hardcodeados salvo el SVG de Google.
   - Mostrar mensajes útiles: credenciales incorrectas, email sin confirmar, redirección a admin, sesión detectada.

4. **Fortalecer guard y diagnóstico de admin**
   - Mantener `RoleGuard` seguro, pero ajustar redirección para que un superadmin autenticado nunca quede atrapado en `/login` o `/admin/diag` por estado de carga.
   - Añadir una verificación de permisos más tolerante a timeouts: si el usuario maestro tiene sesión y rol `superadmin`, entra directo.

5. **Validación final**
   - Revisar logs/navegación después de implementar.
   - Confirmar por código que `eduardotp77@gmail.com` queda dirigido a `/admin` tras login por email y Google.
   - No cambiar contraseñas ni exponer claves privadas.

## Archivos previstos

- `src/pages/Login.tsx`
- `src/context/AuthContext.tsx` si hace falta exponer una función de refresco de sesión/rol.
- `src/components/RoleGuard.tsx` para robustecer redirecciones y fallback maestro.

## Sin cambios previstos

- No tocaré `src/integrations/supabase/client.ts`.
- No crearé tablas nuevas.
- No modificaré claves ni secretos.
- No habilitaré auto-confirmación de email.