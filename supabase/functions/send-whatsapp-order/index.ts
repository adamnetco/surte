const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create authenticated client for user context
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabaseUser.auth.getUser();
      userId = user?.id || null;
    }

    const { items, customer_name, customer_phone, customer_address, notes, delivery_price, delivery_zone_id, preferred_delivery_date, preferred_time_slot, payment_method, geo_location } = await req.json();

    if (!items?.length || !customer_name || !customer_phone) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const deliveryAmount = Number(delivery_price) || 0;
    const total = subtotal + deliveryAmount;

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name,
        customer_phone,
        customer_address: customer_address || null,
        notes: notes || null,
        subtotal,
        delivery_price: deliveryAmount,
        delivery_zone_id: delivery_zone_id || null,
        total,
        user_id: userId,
        status: 'pendiente',
        preferred_delivery_date: preferred_delivery_date || null,
        preferred_time_slot: preferred_time_slot || null,
        payment_method: payment_method || 'efectivo',
      })
      .select()
      .single();

    if (orderError) {
      return new Response(JSON.stringify({ error: orderError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id || null,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));

    await supabaseAdmin.from('order_items').insert(orderItems);

    // Format WhatsApp message
    const formatPrice = (p: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p);

    const orderLines = items.map(
      (i: any) => `- ${i.quantity}x ${i.name} ${formatPrice(i.price * i.quantity)}`
    );

    const whatsappMessage = [
      `*Nuevo Pedido SURTE #${order.order_number}*`,
      '',
      `Nombre: ${customer_name}`,
      `Tel: ${customer_phone}`,
      customer_address ? `Dir: ${customer_address}` : '',
      geo_location ? `Mapa: https://www.google.com/maps?q=${geo_location}` : '',
      notes ? `Notas: ${notes}` : '',
      '',
      ...orderLines,
      '',
      `*Total: ${formatPrice(total)}*`,
      '',
      preferred_delivery_date ? `Entrega: ${preferred_delivery_date}${preferred_time_slot ? ` (${preferred_time_slot === 'manana' ? '8am-12pm' : '2pm-6pm'})` : ''}` : '',
      `Pago: ${payment_method === 'transferencia' ? 'Transferencia' : 'Efectivo'}`,
      '',
      `Estado: Pendiente`,
    ].filter(Boolean).join('\n');

    // Update order with whatsapp ref
    await supabaseAdmin.from('orders').update({ whatsapp_ref: `msg_${order.order_number}` }).eq('id', order.id);

    // Send order confirmation email if user has email
    if (userId) {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUser?.email) {
        try {
          await supabaseAdmin.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'order-confirmation',
              recipientEmail: authUser.email,
              idempotencyKey: `order-confirm-${order.id}`,
              templateData: {
                customerName: customer_name,
                orderNumber: order.order_number,
                items: items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                total,
                address: customer_address || undefined,
              },
            },
          });
        } catch (emailErr) {
          console.error('Failed to send order confirmation email:', emailErr);
          // Non-fatal — order was already created
        }
      }
    }

    // Try sending via YCloud
    let whatsappSent = false;
    let whatsappFallbackUrl: string | null = null;

    // Get YCloud settings
    const { data: ycloudSettings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['ycloud_api_key', 'ycloud_from_number', 'whatsapp_number']);

    const settingsMap: Record<string, string> = {};
    ycloudSettings?.forEach((r: any) => { settingsMap[r.key] = r.value; });

    const ycloudApiKey = settingsMap.ycloud_api_key;
    const ycloudFrom = settingsMap.ycloud_from_number;

    if (ycloudApiKey && ycloudFrom) {
      try {
        // Send to customer
        const yRes = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
          method: 'POST',
          headers: {
            'X-API-Key': ycloudApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: ycloudFrom,
            to: customer_phone.replace(/\D/g, ''),
            type: 'text',
            text: { body: whatsappMessage },
          }),
        });
        const yData = await yRes.json();
        whatsappSent = yRes.ok;
        if (!yRes.ok) {
          console.error('YCloud send error:', yData);
        } else {
          // Update order with YCloud message reference
          await supabaseAdmin.from('orders').update({ whatsapp_ref: yData.id || `ycloud_${order.order_number}` }).eq('id', order.id);
        }
      } catch (e) {
        console.error('YCloud API error:', e);
      }
    }

    if (!whatsappSent) {
      const whatsappNumber = settingsMap.whatsapp_number || '573000000000';
      whatsappFallbackUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      whatsapp_sent: whatsappSent,
      whatsapp_fallback_url: whatsappFallbackUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});