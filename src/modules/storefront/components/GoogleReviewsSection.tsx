import { useEffect, useState } from "react";
import { Star, ExternalLink } from "lucide-react";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
}

/**
 * Shows Google reviews embedded via the Google Maps share link.
 * Since we can't fetch Google Places API reviews client-side without a key,
 * we use the testimonials table as a mirror and show a link to leave a review.
 */
const GoogleReviewsSection = () => {
  const { data: settings } = useAppSettings();
  const googleMapsUrl = settings?.google_maps_url;
  const placeId = settings?.google_place_id;

  if (!googleMapsUrl) return null;

  // Build review URL
  const reviewUrl = googleMapsUrl.includes("maps")
    ? `${googleMapsUrl}`
    : googleMapsUrl;

  return (
    <section className="py-6 px-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-bold text-base text-foreground">Reseñas de Google</h2>
          <p className="text-xs text-muted-foreground">Lo que dicen nuestros clientes</p>
        </div>
        <a
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Star size={12} /> Dejar reseña
        </a>
      </div>

      {/* Embed Google Maps reviews iframe */}
      {settings?.google_maps_embed && (
        <div className="rounded-xl overflow-hidden border border-border">
          <iframe
            src={settings.google_maps_embed}
            width="100%"
            height="250"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Maps - SURTÉ YA"
          />
        </div>
      )}

      <a
        href={reviewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
      >
        <ExternalLink size={12} /> Ver todas las reseñas en Google Maps
      </a>
    </section>
  );
};

export default GoogleReviewsSection;
