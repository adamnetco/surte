# Realtime

WebSocket: `wss://dimyhjzcwlgfczimqhet.supabase.co/realtime/v1`

Sólo las tablas añadidas a la publicación `supabase_realtime` emiten eventos. Actualmente:

- `orders` — seguimiento de pedidos (`/pedido/:orderNumber`).
- `persistent_carts` — carrito omnicanal.
- `kds_tickets` — pantalla cocina (KDS).
- `notification_subscriptions`, `push_broadcast_logs` — push.

## Suscripción

```ts
import { supabase } from "@/integrations/supabase/client";

const channel = supabase
  .channel("orders-feed")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "orders" },
    (payload) => console.log(payload.eventType, payload.new ?? payload.old),
  )
  .subscribe();

// cleanup
supabase.removeChannel(channel);
```

## Filtros

```ts
.on("postgres_changes",
  { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
  handler)
```

## Presence / Broadcast (no DB)

```ts
const room = supabase.channel("pos-room-1", { config: { presence: { key: userId } } });
room.on("presence", { event: "sync" }, () => console.log(room.presenceState()));
room.on("broadcast", { event: "ticket" }, ({ payload }) => console.log(payload));
await room.subscribe(async (status) => {
  if (status === "SUBSCRIBED") room.track({ name: "Eduardo" });
});
room.send({ type: "broadcast", event: "ticket", payload: { id: 42 } });
```

> Las RLS de la tabla se aplican: si tu `access_token` no puede leer la fila, no recibes el evento.
