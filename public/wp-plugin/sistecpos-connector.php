<?php
/**
 * Plugin Name: Sistecpos Connector
 * Plugin URI:  https://sistecpos.com
 * Description: Conecta tu WordPress headless con Sistecpos (Lovable Cloud) para revalidación automática del frontend Astro y exposición de contenido por tenant. Configura tu site_id y plugin_token desde Ajustes → Sistecpos.
 * Version:     1.0.0
 * Author:      Sistecpos
 * License:     GPL-2.0-or-later
 * Text Domain: sistecpos-connector
 */

if (!defined('ABSPATH')) { exit; }

define('SISTECPOS_API_BASE', 'https://dimyhjzcwlgfczimqhet.supabase.co/functions/v1');
define('SISTECPOS_OPT', 'sistecpos_connector_options');

/* ──────────────────────────────────────────────
 *  Admin settings page
 * ────────────────────────────────────────────── */
add_action('admin_menu', function () {
  add_options_page('Sistecpos', 'Sistecpos', 'manage_options', 'sistecpos-connector', 'sistecpos_render_settings');
});

add_action('admin_init', function () {
  register_setting('sistecpos_group', SISTECPOS_OPT, ['sanitize_callback' => 'sistecpos_sanitize']);
});

function sistecpos_sanitize($input) {
  return [
    'site_id'      => sanitize_text_field($input['site_id'] ?? ''),
    'plugin_token' => sanitize_text_field($input['plugin_token'] ?? ''),
    'enabled'      => !empty($input['enabled']) ? 1 : 0,
  ];
}

function sistecpos_render_settings() {
  if (!current_user_can('manage_options')) return;
  $o = wp_parse_args(get_option(SISTECPOS_OPT, []), ['site_id'=>'','plugin_token'=>'','enabled'=>0]);
  ?>
  <div class="wrap">
    <h1>Sistecpos Connector</h1>
    <p>Configura las credenciales que aparecen en <strong>Sistecpos → Sitios → Plugin WP</strong>.</p>
    <form method="post" action="options.php">
      <?php settings_fields('sistecpos_group'); ?>
      <table class="form-table">
        <tr>
          <th><label>Site ID</label></th>
          <td><input type="text" name="<?php echo SISTECPOS_OPT; ?>[site_id]" value="<?php echo esc_attr($o['site_id']); ?>" class="regular-text" placeholder="uuid del sitio" required></td>
        </tr>
        <tr>
          <th><label>Plugin token</label></th>
          <td><input type="password" name="<?php echo SISTECPOS_OPT; ?>[plugin_token]" value="<?php echo esc_attr($o['plugin_token']); ?>" class="regular-text" autocomplete="off" required>
              <p class="description">Se envía como header <code>X-WP-Signature</code> en cada llamada.</p></td>
        </tr>
        <tr>
          <th><label>Activo</label></th>
          <td><label><input type="checkbox" name="<?php echo SISTECPOS_OPT; ?>[enabled]" value="1" <?php checked(1, $o['enabled']); ?>> Notificar a Sistecpos en publicaciones</label></td>
        </tr>
      </table>
      <?php submit_button(); ?>
    </form>

    <h2>Probar conexión</h2>
    <p><button class="button" id="sistecpos-test">Enviar ping</button> <span id="sistecpos-test-result"></span></p>
    <script>
      document.getElementById('sistecpos-test').addEventListener('click', async function(e){
        e.preventDefault();
        const out = document.getElementById('sistecpos-test-result');
        out.textContent = 'Enviando…';
        const res = await fetch(<?php echo wp_json_encode(rest_url('sistecpos/v1/ping')); ?>, {
          headers: { 'X-WP-Nonce': '<?php echo wp_create_nonce('wp_rest'); ?>' }
        });
        const data = await res.json().catch(()=>({}));
        out.textContent = res.ok ? '✓ ' + (data.message || 'OK') : '✗ ' + (data.message || res.statusText);
      });
    </script>
  </div>
  <?php
}

/* ──────────────────────────────────────────────
 *  Llamada autenticada a Sistecpos
 * ────────────────────────────────────────────── */
function sistecpos_notify($action, $post = null) {
  $o = get_option(SISTECPOS_OPT, []);
  if (empty($o['enabled']) || empty($o['site_id']) || empty($o['plugin_token'])) return;

  $payload = [
    'wp_base_url' => home_url(),
    'action'      => $action,
    'post'        => $post ? [
      'id'    => $post->ID,
      'slug'  => $post->post_name,
      'type'  => $post->post_type,
      'title' => get_the_title($post),
      'link'  => get_permalink($post),
    ] : null,
  ];

  $url = add_query_arg(['site_id' => $o['site_id']], SISTECPOS_API_BASE . '/wp-revalidate-webhook');

  wp_remote_post($url, [
    'timeout'  => 10,
    'blocking' => false,
    'headers'  => [
      'Content-Type'    => 'application/json',
      'X-WP-Signature'  => $o['plugin_token'],
    ],
    'body' => wp_json_encode($payload),
  ]);
}

/* ──────────────────────────────────────────────
 *  Hooks de publicación
 * ────────────────────────────────────────────── */
add_action('transition_post_status', function ($new, $old, $post) {
  if (wp_is_post_revision($post)) return;
  if (!in_array($post->post_type, ['post','page','producto'], true)) return;
  if ($new === 'publish' || $old === 'publish') {
    sistecpos_notify($new === 'publish' ? 'publish' : 'unpublish', $post);
  }
}, 10, 3);

add_action('deleted_post', function ($post_id) {
  $p = get_post($post_id);
  if ($p) sistecpos_notify('delete', $p);
});

/* ──────────────────────────────────────────────
 *  REST ping para probar la conexión
 * ────────────────────────────────────────────── */
add_action('rest_api_init', function () {
  register_rest_route('sistecpos/v1', '/ping', [
    'methods'  => 'GET',
    'permission_callback' => function () { return current_user_can('manage_options'); },
    'callback' => function () {
      $o = get_option(SISTECPOS_OPT, []);
      if (empty($o['site_id']) || empty($o['plugin_token'])) {
        return new WP_REST_Response(['ok'=>false,'message'=>'Configura site_id y plugin_token primero.'], 400);
      }
      $url = add_query_arg(['site_id'=>$o['site_id']], SISTECPOS_API_BASE . '/wp-revalidate-webhook');
      $res = wp_remote_post($url, [
        'timeout' => 10,
        'headers' => ['Content-Type'=>'application/json','X-WP-Signature'=>$o['plugin_token']],
        'body'    => wp_json_encode(['wp_base_url'=>home_url(),'action'=>'ping']),
      ]);
      if (is_wp_error($res)) return new WP_REST_Response(['ok'=>false,'message'=>$res->get_error_message()], 500);
      $code = wp_remote_retrieve_response_code($res);
      $body = json_decode(wp_remote_retrieve_body($res), true);
      return new WP_REST_Response(['ok'=>$code===200,'message'=>$body['error'] ?? ('HTTP '.$code)], $code);
    },
  ]);
});
