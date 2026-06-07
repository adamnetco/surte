# Cart module

Utilidades del carrito omnicanal (web + WhatsApp Flow).

## Estructura
- `lib/cartToken.ts` — UUID anónimo persistido en `localStorage` (`surteya_cart_token`), compartido entre web y WhatsApp Flow para sincronizar el carrito vía `persistent_carts` + edge function `cart-sync`.

## Reglas
- No deep imports: usar `@/modules/cart`.
- El contexto del carrito (`src/context/CartContext.tsx`) consume estas utilidades.
- TTL persistente: 24h en localStorage (ver memoria `persistent-cart`).

## Próximo módulo sugerido
Consolidar `hooks/` sueltos (`useStore`, `useFavorites`, `useFeatureFlag`, `useProfile`, `useImageUpload`).
