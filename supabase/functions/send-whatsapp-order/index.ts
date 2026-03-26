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
    const supabaseAnonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
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

    const { items, customer_name, customer_phone, customer_address, notes } = await req.json();

    if (!items?.length || !customer_name || !customer_phone) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const total = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name,
        customer_phone,
        customer_address: customer_address || null,
        notes: notes || null,
        total,
        user_id: userId,
        status: 'pendiente',
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
      (i: any) => `• ${i.quantity}x ${i.name} — ${formatPrice(i.price * i.quantity)}`
    );

    const whatsappMessage = [
      `🛒 *Nuevo Pedido SURTÉ #${order.order_number}*`,
      '',
      `👤 ${customer_name}`,
      `📱 ${customer_phone}`,
      customer_address ? `📍 ${customer_address}` : '',
      notes ? `📝 ${notes}` : '',
      '',
      ...orderLines,
      '',
      `💰 *Total: ${formatPrice(total)}*`,
      '',
      `📦 Estado: Pendiente`,
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

    // Check if WhatsApp API token is configured
    const whatsappToken = Deno.env.get('WHATSAPP_API_TOKEN');
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_ID');
    
    let whatsappSent = false;
    if (whatsappToken && whatsappPhoneId) {
      // Send via WhatsApp Cloud API
      try {
        const adminPhone = Deno.env.get('ADMIN_WHATSAPP') || customer_phone;
        const response = await fetch(`https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: adminPhone.replace(/\D/g, ''),
            type: 'text',
            text: { body: whatsappMessage },
          }),
        });
        whatsappSent = response.ok;
      } catch (e) {
        console.error('WhatsApp API error:', e);
      }
    }

    // Get settings for whatsapp number fallback
    const { data: settingsData } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'whatsapp_number').single();
    const whatsappNumber = settingsData?.value || '573000000000';

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      whatsapp_sent: whatsappSent,
      whatsapp_fallback_url: !whatsappSent
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
        : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});