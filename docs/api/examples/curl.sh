#!/usr/bin/env bash
# Ejemplos curl listos para copy-paste.
# Exporta primero:
#   export URL=https://dimyhjzcwlgfczimqhet.supabase.co
#   export ANON_KEY="eyJhbGci..."   # ver docs/api/README.md
#   export TOKEN="..."              # access_token de un login

set -euo pipefail

# 1) Listar productos activos
curl -s "$URL/rest/v1/products?is_active=eq.true&select=id,name,slug,price&limit=10" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# 2) Buscar productos por texto
curl -s "$URL/rest/v1/products?or=(name.ilike.*pulpa*,description.ilike.*pulpa*)&limit=5" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# 3) Categorías
curl -s "$URL/rest/v1/categories?is_active=eq.true&order=sort_order.asc" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# 4) Login
curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@surteya.co","password":"********"}'

# 5) Usuario actual
curl -s "$URL/auth/v1/user" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN"

# 6) Crear un pedido (requiere token con rol válido)
curl -s -X POST "$URL/rest/v1/orders" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{
    "customer_name":"Cliente Demo",
    "customer_phone":"3001112233",
    "customer_address":"Cra 1 # 2-3",
    "city":"Bucaramanga",
    "subtotal":50000,"delivery_price":5000,"total":55000,
    "status":"pending","payment_method":"contraentrega"
  }'

# 7) RPC validar cupón
curl -s -X POST "$URL/rest/v1/rpc/validate_coupon" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"_code":"BIENVENIDO","_order_total":80000}'

# 8) Edge function: capturar lead
curl -s -X POST "$URL/functions/v1/lead-capture" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Eduardo","phone":"3001112233","source":"web"}'

# 9) Subir imagen al bucket público
curl -s -X POST "$URL/storage/v1/object/product-images/demo/test.webp" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/webp" --data-binary @./test.webp
