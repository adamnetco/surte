// Etapa 23: JWT + role admin requerido (operación de backoffice).
import {
  corsHeaders, jsonResponse, requireAuth, requireAdminRole, serviceClient,
} from "../_shared/tenant-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_API_KEY) {
      return jsonResponse({ error: "GOOGLE_PLACES_API_KEY not configured" }, 500);
    }

    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const supabase = serviceClient();
    const roleGate = await requireAdminRole(supabase, auth.userId, auth.isServiceRole);
    if (roleGate !== true) return roleGate;

    // Get place_id from app_settings
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["google_place_id"]);

    const placeId = settingsData?.find((s: any) => s.key === "google_place_id")?.value;
    if (!placeId) {
      return new Response(JSON.stringify({ error: "google_place_id not configured in app_settings" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch reviews from Google Places API (New)
    const url = `https://places.googleapis.com/v1/places/${placeId}?fields=reviews,rating,userRatingCount&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": GOOGLE_API_KEY },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Google API error:", response.status, errBody);
      return new Response(JSON.stringify({ error: `Google API error: ${response.status}`, details: errBody }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reviews = data.reviews || [];
    const placeRating = data.rating;
    const totalReviews = data.userRatingCount;

    let imported = 0;
    let skipped = 0;

    for (const review of reviews) {
      const authorName = review.authorAttribution?.displayName || "Anónimo";
      const rating = review.rating || 5;
      const text = review.text?.text || review.originalText?.text || "";
      const photoUrl = review.authorAttribution?.photoUri || null;
      const reviewDate = review.publishTime || null;

      // Check if already exists by author_name + rating combo (simple dedup)
      const { data: existing } = await supabase
        .from("google_reviews")
        .select("id")
        .eq("author_name", authorName)
        .eq("rating", rating)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("google_reviews").insert({
        author_name: authorName,
        rating,
        review_text: text,
        profile_photo_url: photoUrl,
        review_date: reviewDate,
        is_active: true,
      });

      if (!insertError) imported++;
      else console.error("Insert error:", insertError);
    }

    // Save aggregate rating info
    if (placeRating) {
      await supabase.from("app_settings").upsert(
        { key: "google_place_rating", value: String(placeRating) },
        { onConflict: "key" }
      );
    }
    if (totalReviews) {
      await supabase.from("app_settings").upsert(
        { key: "google_place_total_reviews", value: String(totalReviews) },
        { onConflict: "key" }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        totalFromGoogle: reviews.length,
        placeRating,
        totalReviews,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
