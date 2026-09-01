/**
 * Tenant manifest builder — runtime genérico SistecPOS Desktop.
 *
 * Construye el "tenant package" (branding + módulos + defaults) para UNA
 * organización. Nunca debe recibir ni devolver datos de otro tenant: quien
 * llama es responsable de validar que la licencia/activación pertenece a
 * `organizationId` antes de invocar esta función.
 */

export interface TenantManifest {
  organization_id: string;
  slug: string | null;
  name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  enabled_modules: string[];
  plan: string | null;
  locations: Array<{ id: string; name: string | null; city: string | null }>;
  fiscal: {
    einvoice_enabled: boolean;
    provider: string | null;
    default_document_type: string | null;
  };
  printer_defaults: {
    connection: string | null;
    paper_width_mm: number | null;
    printer_name: string | null;
  };
  feature_flags: Record<string, unknown>;
  offline_bootstrap_version: string;
  updated_at: string;
}

type AnyClient = {
  from: (table: string) => any;
};

function pick<T>(row: Record<string, unknown> | null, key: string, fallback: T | null = null) {
  if (!row) return fallback;
  const v = row[key];
  return (v === undefined ? fallback : (v as T | null));
}

/** Hash estable y corto para versionar el bootstrap offline. */
async function shortHash(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildTenantManifest(
  supa: AnyClient,
  organizationId: string,
): Promise<TenantManifest> {
  if (!organizationId) throw new Error("organization_id_required");

  const [orgRes, modulesRes, settingsRes, locationsRes, einvoiceRes, printerRes] = await Promise.all([
    supa.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
    supa.from("organization_modules").select("module_key, is_enabled").eq("organization_id", organizationId),
    supa.from("app_settings").select("key, value").eq("organization_id", organizationId),
    supa.from("locations").select("id, name, city").eq("organization_id", organizationId).limit(50),
    supa.from("einvoice_configs").select("*").eq("organization_id", organizationId).maybeSingle(),
    supa.from("printers").select("connection, paper_width_mm, printer_name, is_default")
      .eq("organization_id", organizationId).order("is_default", { ascending: false }).limit(1),
  ]);

  const org = (orgRes?.data ?? null) as Record<string, unknown> | null;
  if (!org) throw new Error("organization_not_found");

  const settings: Record<string, unknown> = {};
  for (const row of (settingsRes?.data ?? []) as Array<{ key: string; value: unknown }>) {
    settings[row.key] = row.value;
  }

  const enabled_modules = ((modulesRes?.data ?? []) as Array<{ module_key: string; is_enabled: boolean }>)
    .filter((m) => m.is_enabled !== false)
    .map((m) => m.module_key)
    .sort();

  const einvoice = (einvoiceRes?.data ?? null) as Record<string, unknown> | null;
  const printer = ((printerRes?.data ?? []) as Array<Record<string, unknown>>)[0] ?? null;

  const manifest: Omit<TenantManifest, "offline_bootstrap_version"> = {
    organization_id: organizationId,
    slug: pick<string>(org, "slug"),
    name: pick<string>(org, "name") ?? pick<string>(org, "display_name"),
    logo_url: pick<string>(org, "logo_url"),
    primary_color: pick<string>(org, "primary_color") ?? (settings["theme_primary"] as string | null) ?? null,
    accent_color: pick<string>(org, "accent_color") ?? (settings["theme_accent"] as string | null) ?? null,
    enabled_modules,
    plan: pick<string>(org, "plan") ?? pick<string>(org, "plan_code"),
    locations: ((locationsRes?.data ?? []) as Array<Record<string, unknown>>).map((l) => ({
      id: String(l.id),
      name: (l.name as string | null) ?? null,
      city: (l.city as string | null) ?? null,
    })),
    fiscal: {
      einvoice_enabled: Boolean(einvoice && (einvoice.is_active ?? einvoice.enabled ?? false)),
      provider: (einvoice?.provider as string | null) ?? null,
      default_document_type: (einvoice?.default_document_type as string | null) ?? null,
    },
    printer_defaults: {
      connection: (printer?.connection as string | null) ?? null,
      paper_width_mm: (printer?.paper_width_mm as number | null) ?? null,
      printer_name: (printer?.printer_name as string | null) ?? null,
    },
    feature_flags: (settings["feature_flags"] as Record<string, unknown>) ?? {},
    updated_at: (pick<string>(org, "updated_at") ?? new Date().toISOString()) as string,
  };

  return {
    ...manifest,
    offline_bootstrap_version: await shortHash(JSON.stringify(manifest)),
  };
}
