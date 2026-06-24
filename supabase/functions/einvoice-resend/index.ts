// einvoice-resend — Acciones rápidas sobre una factura ya emitida.
// AC7/AC9 de POS-innapsis-emision-pos.
// Acciones:
//   - send_email     → reenvía PDF/XML por email vía resend-mail-service
//   - send_whatsapp  → envía link al cliente vía send-ycloud-whatsapp
//   - retry_now      → fuerza nuevo intento bypass backoff (admin/superadmin)
//
// verify_jwt=true en config.toml.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  invoice_id: z.string().uuid(),
  action: z.enum(["send_email", "send_whatsapp", "retry_now"]),
  to: z.string().max(200).optional(), // email o teléfono override
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
    const token = authHeader.replace("Bearer ", "");

    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await sbUser.auth.getUser(token);
    if (userErr || !userRes?.user) return json(401, { error: "Unauthorized" });
    const userId = userRes.user.id;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(400, { error: "invalid_payload", details: parsed.error.flatten() });
    const { invoice_id, action, to } = parsed.data;

    // Cargar factura + verificar pertenencia a la org del caller
    const { data: invoice, error: invErr } = await supabase
      .from("electronic_invoices")
      .select("id, organization_id, full_number, prefix, number, pdf_url, xml_url, qr_url, cufe, status, customer_email, customer_name, pos_order_id, total, document_type")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr || !invoice) return json(404, { error: "invoice_not_found" });

    // Verificar membresía
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", invoice.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return json(403, { error: "Forbidden" });

    const isAdmin = ["owner", "admin", "superadmin"].includes(String(member.role));

    // ============================================================
    // RETRY NOW — requiere admin/owner/superadmin (AC9)
    // ============================================================
    if (action === "retry_now") {
      if (!isAdmin) return json(403, { error: "admin_required" });
      if (!["retrying", "rejected", "error", "dead_letter"].includes(String(invoice.status))) {
        return json(400, { error: "invoice_not_retriable", status: invoice.status });
      }

      // Encolar nuevo intento vía outbox (bypass del backoff: next_retry_at=now)
      await supabase
        .from("electronic_invoices")
        .update({ status: "queued", retry_count: 0, next_retry_at: null, last_error: null })
        .eq("id", invoice_id);

      const { error: outErr } = await supabase
        .from("sync_outbox")
        .insert({
          organization_id: invoice.organization_id,
          operation: "einvoice_emit",
          payload: { invoice_id, forced_retry: true, forced_by: userId },
          status: "pending",
        });
      if (outErr) return json(500, { error: "enqueue_failed", details: outErr.message });

      await supabase.from("einvoice_events").insert({
        organization_id: invoice.organization_id,
        invoice_id,
        event_type: "manual_retry",
        performed_by: userId,
        payload: { forced: true },
      });

      return json(200, { success: true, message: "Reintento encolado" });
    }

    // ============================================================
    // SEND EMAIL (AC7)
    // ============================================================
    if (action === "send_email") {
      if (invoice.status !== "accepted" && invoice.status !== "approved") {
        return json(400, { error: "invoice_not_accepted", status: invoice.status });
      }
      const destEmail = (to ?? invoice.customer_email ?? "").trim();
      if (!destEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destEmail)) {
        return json(400, { error: "invalid_email" });
      }

      const subject = `Factura ${invoice.full_number ?? invoice.prefix + invoice.number} — DIAN`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
          <h2 style="margin:0 0 8px">Hola ${invoice.customer_name ?? "cliente"},</h2>
          <p>Adjuntamos los documentos de tu factura electrónica DIAN.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:6px 0;color:#64748b">Número</td><td style="padding:6px 0"><b>${invoice.full_number ?? ""}</b></td></tr>
            <tr><td style="padding:6px 0;color:#64748b">CUFE</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${invoice.cufe ?? "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Total</td><td style="padding:6px 0"><b>$${Number(invoice.total ?? 0).toLocaleString("es-CO")}</b></td></tr>
          </table>
          <p style="margin:16px 0">
            ${invoice.pdf_url ? `<a href="${invoice.pdf_url}" style="display:inline-block;padding:10px 16px;background:#0c4b83;color:#fff;border-radius:8px;text-decoration:none;margin-right:8px">Ver PDF</a>` : ""}
            ${invoice.xml_url ? `<a href="${invoice.xml_url}" style="display:inline-block;padding:10px 16px;background:#e2e8f0;color:#0f172a;border-radius:8px;text-decoration:none">Descargar XML</a>` : ""}
          </p>
          <p style="color:#94a3b8;font-size:12px">Documento generado vía DIAN — Innapsis.</p>
        </div>
      `;

      const { error: mailErr } = await supabase.functions.invoke("resend-mail-service", {
        body: { to: destEmail, subject, html },
      });
      if (mailErr) return json(500, { error: "email_send_failed", details: mailErr.message });

      await supabase.from("einvoice_events").insert({
        organization_id: invoice.organization_id,
        invoice_id,
        event_type: "resent_email",
        performed_by: userId,
        payload: { to: destEmail },
      });

      return json(200, { success: true, channel: "email", to: destEmail });
    }

    // ============================================================
    // SEND WHATSAPP (AC7)
    // ============================================================
    if (action === "send_whatsapp") {
      if (invoice.status !== "accepted" && invoice.status !== "approved") {
        return json(400, { error: "invoice_not_accepted", status: invoice.status });
      }

      let destPhone = (to ?? "").replace(/\D/g, "");
      if (!destPhone && invoice.pos_order_id) {
        const { data: po } = await supabase
          .from("pos_orders")
          .select("customer_phone")
          .eq("id", invoice.pos_order_id)
          .maybeSingle();
        destPhone = (po?.customer_phone ?? "").replace(/\D/g, "");
      }
      if (!destPhone || destPhone.length < 7) return json(400, { error: "invalid_phone" });
      if (!destPhone.startsWith("57") && destPhone.length === 10) destPhone = "57" + destPhone;

      const lines = [
        `Factura electronica - ${invoice.full_number ?? ""}`,
        ``,
        `Hola ${invoice.customer_name ?? "cliente"},`,
        `Adjuntamos los enlaces de tu factura DIAN:`,
        ``,
        `Total: $${Number(invoice.total ?? 0).toLocaleString("es-CO")}`,
        `CUFE: ${invoice.cufe ?? "-"}`,
        ``,
        invoice.pdf_url ? `PDF: ${invoice.pdf_url}` : "",
        invoice.xml_url ? `XML: ${invoice.xml_url}` : "",
        ``,
        `Gracias por tu compra.`,
      ].filter(Boolean).join("\n");

      const { error: waErr } = await supabase.functions.invoke("send-ycloud-whatsapp", {
        body: {
          action: "send_text",
          to: destPhone,
          message: lines,
          organization_id: invoice.organization_id,
        },
      });
      if (waErr) return json(500, { error: "whatsapp_send_failed", details: waErr.message });

      await supabase.from("einvoice_events").insert({
        organization_id: invoice.organization_id,
        invoice_id,
        event_type: "resent_whatsapp",
        performed_by: userId,
        payload: { to: destPhone },
      });

      return json(200, { success: true, channel: "whatsapp", to: destPhone });
    }

    return json(400, { error: "unknown_action" });
  } catch (err) {
    console.error("einvoice-resend error:", err);
    return json(500, { error: err instanceof Error ? err.message : "internal_error" });
  }
});
