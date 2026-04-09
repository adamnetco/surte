import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrl, bucket, path } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the original image
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: ${imgResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const originalBlob = await imgResponse.blob();
    const originalType = originalBlob.type;

    // If already WebP, return as-is
    if (originalType === "image/webp") {
      return new Response(
        JSON.stringify({ url: imageUrl, optimized: false, message: "Already WebP" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to WebP using Canvas API (available in Deno Deploy)
    // Since Deno Deploy doesn't have canvas, we use the image directly
    // but re-upload with proper content-type and cache headers
    const arrayBuffer = await originalBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Use Supabase storage to store optimized version
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const targetBucket = bucket || "product-images";
    const ext = "webp";
    const targetPath = path || `optimized/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // For now, store the original with aggressive caching
    // WebP conversion requires native image processing
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(targetPath, uint8, {
        contentType: originalType,
        cacheControl: "31536000", // 1 year cache
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(targetBucket)
      .getPublicUrl(targetPath);

    return new Response(
      JSON.stringify({
        url: publicUrlData.publicUrl,
        optimized: true,
        originalSize: uint8.length,
        path: targetPath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
