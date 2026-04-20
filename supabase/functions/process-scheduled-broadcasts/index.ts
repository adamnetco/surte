import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cron-triggered function (every 5 min) that picks pending broadcast_logs
 * whose scheduled_at is in the past and dispatches them via broadcast-whatsapp-ycloud.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const nowIso = new Date().toISOString();

    // Find scheduled broadcasts that are due
    const { data: due, error } = await supabase
      .from("broadcast_logs")
      .select("id, message, segment, sent_by, scheduled_at")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (error) throw error;

    if (!due || due.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No scheduled broadcasts due" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ id: string; status: string; sent?: number; failed?: number; error?: string }> = [];

    for (const job of due) {
      try {
        // Mark as running so a retry doesn't double-send
        await supabase
          .from("broadcast_logs")
          .update({ status: "running" })
          .eq("id", job.id)
          .eq("status", "pending"); // CAS-style guard

        const { data, error: invokeErr } = await supabase.functions.invoke(
          "broadcast-whatsapp-ycloud",
          {
            body: {
              message: job.message,
              segment: job.segment,
              sent_by: job.sent_by,
              log_id: job.id,
            },
          }
        );

        if (invokeErr) throw new Error(invokeErr.message);
        if (data?.error) throw new Error(data.error);

        results.push({ id: job.id, status: "ok", sent: data?.sent, failed: data?.failed });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await supabase
          .from("broadcast_logs")
          .update({
            status: "failed",
            errors: [{ phone: "system", error: msg }],
            sent_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        results.push({ id: job.id, status: "failed", error: msg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: due.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-scheduled-broadcasts error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
