# Sistecpos Connector – Plugin WordPress

Conecta tu WordPress headless con Sistecpos. Notifica al frontend Astro cada vez que publicas o actualizas contenido, para que la caché se revalide automáticamente.

## Instalación

1. Descarga `sistecpos-connector.php`.
2. Súbelo a `wp-content/plugins/sistecpos-connector/sistecpos-connector.php` (o instálalo como ZIP).
3. En el admin de WP → **Plugins → Sistecpos Connector → Activar**.
4. Ve a **Ajustes → Sistecpos** y pega:
   - **Site ID**: el UUID que aparece en Sistecpos → Sitios.
   - **Plugin token**: el `plugin_token` que aparece junto al sitio.
5. Marca **Activo** y guarda.
6. Pulsa **Enviar ping** para validar la conexión.

## Seguridad

- Las credenciales viajan como header `X-WP-Signature` por HTTPS.
- El token se genera por sitio. Si lo pierdes, regenéralo desde Sistecpos → Sitios.
- El plugin no expone ningún endpoint público adicional; solo el ping requiere `manage_options`.
