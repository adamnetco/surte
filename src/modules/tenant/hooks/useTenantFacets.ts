import { useMemo } from "react";
import { useTenantProfile } from "./useTenantProfile";
import { useTenantSettings } from "./useTenantSettings";

/**
 * Facetas tenant-aware de alto nivel para reemplazar literales hardcodeados
 * en el código del core. SIEMPRE devuelven fallbacks neutros — nunca
 * "SurteYa", "Bucaramanga", "Santander", "+573…".
 */

const NEUTRAL = {
  storeName: "Mi Negocio",
  city: "Colombia",
  region: "",
  whatsapp: "",
  email: "",
  primaryColor: "#0C4B83",
  accentColor: "#F37021",
  heroTitle: "Bienvenido",
  heroSubtitle: "",
  tagline: "",
  locale: "es-CO",
};

export function useTenantBranding() {
  const { data } = useTenantProfile();
  const settings = useTenantSettings("branding.");
  return useMemo(
    () => ({
      name: data?.name ?? NEUTRAL.storeName,
      legalName: data?.legal_name ?? data?.name ?? NEUTRAL.storeName,
      logoUrl: data?.logo_url ?? settings.get("branding.logo") ?? null,
      favicon: settings.get("branding.favicon") || null,
      primaryColor: data?.primary_color ?? NEUTRAL.primaryColor,
      accentColor: data?.accent_color ?? NEUTRAL.accentColor,
      heroTitle: data?.hero_title ?? NEUTRAL.heroTitle,
      heroSubtitle: data?.hero_subtitle ?? NEUTRAL.heroSubtitle,
      tagline: data?.tagline ?? NEUTRAL.tagline,
    }),
    [data, settings.data]
  );
}

export function useTenantContact() {
  const { data } = useTenantProfile();
  return useMemo(
    () => ({
      whatsapp: data?.whatsapp_phone ?? NEUTRAL.whatsapp,
      email: data?.support_email ?? NEUTRAL.email,
      city: data?.city ?? NEUTRAL.city,
      region: data?.region ?? NEUTRAL.region,
      country: data?.country ?? "CO",
      taxId: data?.tax_id ?? "",
    }),
    [data]
  );
}

export function useTenantLegal() {
  const settings = useTenantSettings("legal.");
  return {
    privacyHtml: settings.get("legal.privacy_html"),
    termsHtml: settings.get("legal.terms_html"),
    dataTreatmentHtml: settings.get("legal.data_treatment_html"),
  };
}

export function useTenantSeo() {
  const { data } = useTenantProfile();
  const settings = useTenantSettings("seo.");
  return {
    siteName: settings.get("seo.site_name") || data?.name || NEUTRAL.storeName,
    defaultOgImage: settings.get("seo.default_og_image") || null,
    locale: data?.default_locale ?? NEUTRAL.locale,
  };
}
