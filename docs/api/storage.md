# Storage

Base: `https://dimyhjzcwlgfczimqhet.supabase.co/storage/v1`

## Buckets

| Bucket | Público | Uso |
|---|---|---|
| `product-images` | ✅ | imágenes y galería de productos |
| `desktop-releases` | ✅ | binarios firmados del POS desktop |
| `invoices` | ❌ | PDFs/imágenes de facturas escaneadas (OCR) |

## Subir un archivo

```bash
curl -X POST \
  "$URL/storage/v1/object/product-images/cat/mi-imagen.webp" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: image/webp" \
  --data-binary @./mi-imagen.webp
```

## URL pública

```
https://dimyhjzcwlgfczimqhet.supabase.co/storage/v1/object/public/product-images/cat/mi-imagen.webp
```

## SDK

```ts
const { data, error } = await supabase.storage
  .from("product-images")
  .upload(`products/${productId}/${file.name}`, file, { upsert: true });

const { data: { publicUrl } } = supabase.storage
  .from("product-images").getPublicUrl(data.path);
```

## Bucket privado (signed URL)

```ts
const { data } = await supabase.storage
  .from("invoices")
  .createSignedUrl(`scan-123.pdf`, 3600); // 1 h
```

## Optimización

Usa la edge function `optimize-image` para servir WebP responsive con cache 1 año:

```
/functions/v1/optimize-image?url=<storage_url>&w=800&q=80
```
