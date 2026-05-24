# Autenticación

Base: `https://dimyhjzcwlgfczimqhet.supabase.co/auth/v1`

Todas las requests llevan `apikey: <ANON_KEY>`.

---

## 1. Signup (email + password)

```bash
curl -X POST "$URL/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@example.com",
    "password": "********",
    "data": {
      "full_name": "Eduardo Tobacia",
      "phone": "+573001112233",
      "business_type": "horeca"
    }
  }'
```

Disparador `handle_new_user` crea automáticamente:
- Fila en `profiles` con `business_type`.
- Fila en `user_roles` con rol `user`.
- Vincula pedidos invitados que coincidan por email/teléfono.

Respuesta: `{ user, session }`. Si la verificación de email está activa, `session` es `null` hasta que el usuario confirme.

---

## 2. Login email + password

```bash
curl -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"cliente@example.com","password":"********"}'
```

Devuelve:

```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "v1.abc...",
  "expires_in": 3600,
  "token_type": "bearer",
  "user": { "id": "uuid", "email": "..." }
}
```

Guarda `access_token` y úsalo como `Authorization: Bearer ...` en cualquier llamada subsiguiente.

---

## 3. Refresh token

```bash
curl -X POST "$URL/auth/v1/token?grant_type=refresh_token" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"refresh_token":"v1.abc..."}'
```

---

## 4. Logout

```bash
curl -X POST "$URL/auth/v1/logout" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## 5. Recuperación de contraseña

```bash
curl -X POST "$URL/auth/v1/recover" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"cliente@example.com"}'
```

El email enlaza a `/reset-password` (ruta pública en la app), donde el cliente JS hace:

```ts
await supabase.auth.updateUser({ password: nuevaPassword });
```

---

## 6. OAuth con Google (sólo navegador)

En la app web se usa el wrapper de Lovable Cloud:

```ts
import { lovable } from "@/integrations/lovable/index";

await lovable.auth.signInWithOAuth("google", {
  redirect_uri: window.location.origin + "/admin",
});
```

Internamente redirige al broker `oauth.lovable.app` y devuelve a `/~oauth/callback` con `access_token` + `refresh_token` que se persisten en `localStorage`.

Para clientes nativos / scripts: usa email+password o un service token (solo backend).

---

## 7. Obtener usuario actual

```bash
curl "$URL/auth/v1/user" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## 8. Roles

Los roles viven en `user_roles` (`superadmin | admin | editor | agente | user`).

Helper SQL invocable como RPC:

```bash
curl -X POST "$URL/rest/v1/rpc/has_role" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"_user_id":"<uuid>","_role":"admin"}'
```

`eduardotp77@gmail.com` es **master superadmin** inmutable (función `is_master_superadmin`).
