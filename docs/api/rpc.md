# RPC (funciones SQL invocables)

Patrón general:

```http
POST /rest/v1/rpc/<funcion>
apikey: <ANON_KEY>
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{ "<param>": <valor>, ... }
```

Devuelven JSON (escalar, array u objeto).

---

## Autorización / Roles

| Función | Params | Devuelve | Uso |
|---|---|---|---|
| `has_role` | `_user_id uuid, _role app_role` | `boolean` | ¿el usuario tiene ese rol? |
| `has_any_role` | `_user_id uuid, _roles app_role[]` | `boolean` | ¿alguno de esos roles? |
| `get_current_user_role` | — | `app_role` | rol más alto del usuario actual |
| `is_master_superadmin` | `_user_id uuid` (opt) | `boolean` | true sólo para `eduardotp77@gmail.com` |
| `can_access_section` | `_section text` | `boolean` | usa `admin_section_access` |

## Organizaciones / Multi-tenant

| Función | Params | Devuelve |
|---|---|---|
| `is_member_of` | `_org_id uuid` | `boolean` |
| `org_role` | `_org_id uuid` | `text` |
| `user_orgs` | `_user_id uuid` | tabla `(organization_id, role, slug, name)` |
| `default_org_id` | — | `uuid` (slug `surteya`) |
| `has_module` | `_org_id uuid, _module_key text` | `boolean` |
| `log_usage` | `_org_id, _module, _metric, _qty, _meta` | `uuid` |
| `resolve_tenant_by_host` | `_host text` | `jsonb` |

## Carrito persistente

| Función | Params |
|---|---|
| `upsert_persistent_cart` | `_cart_token uuid, _items jsonb, _subtotal numeric, _total_items int, _phone?, _user_id?, _channel?, _metadata?` → `uuid` |
| `get_persistent_cart` | `_cart_token uuid` → fila completa |
| `complete_persistent_cart` | `_cart_token uuid` → `boolean` |

## Cupones

| Función | Params |
|---|---|
| `validate_coupon` | `_code text, _order_total numeric` → `(id, code, discount_type, discount_value, min_order_amount, discount_amount)` |
| `redeem_coupon` | `_coupon_id uuid` → `boolean` |

## Inventario / Compras

| Función | Params |
|---|---|
| `apply_stock_movement` | `_org_id, _warehouse_id, _product_id, _presentation_id, _movement_type, _quantity, _unit_cost?, _reference_type?, _reference_id?, _notes?` → `uuid` |
| `receive_purchase_order` | `_po_id uuid, _warehouse_id uuid` → `{applied, skipped}` |
| `apply_invoice_scan` | `_scan_id uuid, _warehouse_id uuid` → `{applied, skipped}` |
| `rematch_invoice_scan` | `_scan_id uuid` → `{matched, unmatched}` |

## Catálogos base

| `apply_catalog_template` | `_org_id, _template_id, _mode` → `{application_id, created, updated, skipped}` |

## Landing pages

| `get_landing_by_slug` | `_scope text, _slug text` → `jsonb` con `page` + `sections` |

## Servicios / Agenda

| `get_resource_availability` | `_org_id, _resource_id, _day date, _slot_minutes int=30` → tabla `(slot_start, slot_end, is_free)` |

## Licencias desktop

| `create_license` | `_org_id, _plan, _max_terminals, _public_key, _signing_key_id, _expires_at?, _notes?` → `{license_id, license_key}` (solo superadmin) |
| `register_activation` | `_license_key, _fingerprint, _hostname, _platform, _app_version` → `jsonb` |
| `heartbeat_activation` | `_license_key uuid, _fingerprint text` → `{ok, expires_at, status}` |
| `revoke_activation` | `_activation_id uuid, _reason text` → `boolean` |
| `count_active_terminals` | `_license_id uuid` → `int` |

## Email queue (pgmq)

| `enqueue_email` | `queue_name text, payload jsonb` → `bigint` |
| `read_email_batch` | `queue_name, batch_size, vt` → filas |
| `delete_email` | `queue_name text, message_id bigint` → `boolean` |
| `move_to_dlq` | `source_queue, dlq_name, message_id, payload` → `bigint` |

## Ejemplo end-to-end

```bash
curl -X POST "$URL/rest/v1/rpc/validate_coupon" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"_code":"BIENVENIDO","_order_total":80000}'
```
