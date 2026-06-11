// Etapa 22: requiere JWT, valida bucket contra allowlist y hostname imageUrl contra dominios confiables.
import {
  corsHeaders, jsonResponse, requireAuth, serviceClient,
} from "../_shared/tenant-guard.ts";

const ALLOWED_BUCKETS = new Set([
  "product-images", "category-images", "brand-logos", "banners",
  "hero-slides", "gallery", "landing-media", "site-assets", "site-logos",
]);

function isAllowedImageHost(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    // bloquear privados / loopback
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("169.254.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) return false;
    // dominios permitidos: Supabase storage, dominios públicos comunes
    const allowedSuffix = [
      ".supabase.co", ".supabase.in",
      "lovable.app", ".lovable.app",
      ".cloudfront.net", ".amazonaws.com",
      ".googleapis.com", ".googleusercontent.com",
      ".unsplash.com", "images.unsplash.com",
      ".cloudinary.com",
    ];
    return allowedSuffix.some((s) => host === s || host.endsWith(s));
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { imageUrl, bucket, path } = await req.json();
    if (!imageUrl) return jsonResponse({ error: "imageUrl is required" }, 400);
    if (!isAllowedImageHost(imageUrl)) return jsonResponse({ error: "image_host_not_allowed" }, 400);

    const targetBucket = String(bucket || "product-images");
    if (!ALLOWED_BUCKETS.has(targetBucket)) return jsonResponse({ error: "bucket_not_allowed" }, 400);

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return jsonResponse({ error: `Failed to fetch image: ${imgResponse.status}` }, 400);
    }
    const originalBlob = await imgResponse.blob();
    const originalType = originalBlob.type;
    if (originalType === "image/webp") {
      return jsonResponse({ url: imageUrl, optimized: false, message: "Already WebP" });
    }
    const arrayBuffer = await originalBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const supabase = serviceClient();
    // Validar path para evitar traversal
    let targetPath = String(path || `optimized/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`);
    if (targetPath.includes("..") || targetPath.startsWith("/")) {
      return jsonResponse({ error: "invalid_path" }, 400);
    }

    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(targetPath, uint8, {
        contentType: originalType,
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) return jsonResponse({ error: uploadError.message }, 500);

    const { data: publicUrlData } = supabase.storage.from(targetBucket).getPublicUrl(targetPath);
    return jsonResponse({
      url: publicUrlData.publicUrl,
      optimized: true,
      originalSize: uint8.length,
      path: targetPath,
    });
  } catch (err: unknown) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
