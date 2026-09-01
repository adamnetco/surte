# Simulación de venta completa (producto → caja → cobro → sync)

Guion reproducible para validar el flujo local-first de punta a punta. No
requiere hardware: la impresión puede omitirse.

## 0. Preparación

- Sesión iniciada en una tienda (`organization_id` activo en el selector).
- Rol `admin` o `cashier` con PIN configurado (Ajustes POS → Seguridad).

## 1. Crear producto

1. `/admin` → Inventario → **Nuevo producto**.
2. Nombre, precio de venta, código de barras (o generar), stock inicial.
3. Guardar y verificar que aparece en `/pos/vender` (el catálogo local se
   refresca por tenant; si no aparece, botón **Refrescar catálogo**).

**Verificación:** el producto queda con `organization_id` de la tienda activa;
otra tienda no lo ve (RLS + scope explícito en `catalog.ts`).

## 2. Abrir caja

1. `/pos/vender` → panel de apertura (`OpenSessionPanel`).
2. Base inicial (ej. 100.000) → **Abrir caja**.
3. Se crea `cash_sessions` con `status='open'`.

**Verificación:** `/admin/caja` muestra "Cajas abiertas: 1" con la base.

## 3. Cobrar con efectivo

1. Escanear o buscar el producto (F2), cantidad con `+`/`-`.
2. El lector de pantalla anuncia "Total del ticket …" en cada cambio.
3. **Cobrar** (F5) → PIN si está bloqueado → método **Efectivo**.
4. Digitar el recibido con teclado físico (o activar el teclado en pantalla) →
   confirmar.
5. `SaleCompleteDialog` muestra total / recibido / cambio.

**Verificación:** ticket registrado con `pos_sale_commit` (RPC atómica e
idempotente por `idempotency_key`).

## 4. Sincronizar y revisar outbox / conflictos

1. Abrir **Estado del sistema** (barra superior) → pestaña de sincronización.
2. `SyncStatusPanel` muestra: pendientes en outbox, último push, checkpoints de
   pull por entidad y conflictos.
3. Forzar sincronización → los pendientes bajan a 0.

### Probar modo offline

1. DevTools → Network → *Offline* (o cortar la red).
2. Repetir pasos 3: la venta se registra en Dexie y queda en outbox.
3. Restaurar red → push automático; el contador vuelve a 0.

### Provocar un conflicto

1. Con la app offline, editar el precio del producto desde otra sesión online.
2. Volver online: el pull incremental detecta versión distinta y registra una
   entrada en `syncConflicts`.
3. Resolver desde el panel (mantener local / aceptar remoto) y confirmar que la
   bitácora queda vacía.

## 5. Cierre Z

1. `/pos/vender` → **Cerrar caja** → conteo por denominaciones (modo ciego opcional).
2. `/admin/caja` muestra la sesión como cerrada, con esperado, contado y
   diferencia, más los saldos por medio de pago del rango.

## Checklist de aceptación

- [ ] Producto visible solo en su tienda.
- [ ] Caja abierta reflejada en `/admin/caja`.
- [ ] Venta en efectivo con cambio correcto y anuncio accesible del total.
- [ ] Outbox vuelve a 0 después de sincronizar.
- [ ] Venta offline persiste y se sube al reconectar.
- [ ] Conflicto registrado y resoluble.
- [ ] Cierre Z con diferencia calculada.
