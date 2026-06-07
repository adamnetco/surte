/**
 * verifySignupTenantLink
 * -----------------------------------------------------------------------------
 * Tras un signup tenant-aware, valida que:
 *   1) Se envió `organization_slug` en `raw_user_meta_data` (sanity check del
 *      lado del cliente — sin esto el trigger no puede enlazar).
 *   2) El trigger `handle_new_user` resolvió ese slug y guardó
 *      `organization_id` en `public.profiles` para el nuevo usuario.
 *
 * Se ejecuta con polling (el trigger es asíncrono al INSERT en auth.users)
 * y siempre es **no bloqueante**: si falla, devuelve un diagnóstico
 * estructurado para mostrar warning al usuario y loggear al admin, pero
 * NUNCA tira el flujo de registro.
 */
import { supabase } from "@/integrations/supabase/client";

export type SignupLinkStatus =
  | "ok"                          // organization_id guardado y coincide con slug
  | "missing_slug"                // no se envió organization_slug (bug del cliente)
  | "profile_not_created"         // el trigger no creó la fila en profiles
  | "organization_not_linked"     // profile existe pero organization_id es null
  | "slug_mismatch"               // organization_id apunta a otra org distinta al slug
  | "unknown_slug"                // el slug enviado no existe en organizations
  | "timeout"                     // no pudimos validar en el tiempo permitido
  | "error";                      // excepción inesperada

export interface SignupLinkResult {
  status: SignupLinkStatus;
  sentSlug: string | null;
  expectedOrgId: string | null;
  actualOrgId: string | null;
  message: string;
}

interface VerifyArgs {
  email: string;
  sentSlug: string | null;
  /** ms total para esperar al trigger (default 6s) */
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function verifySignupTenantLink({
  email,
  sentSlug,
  timeoutMs = 6000,
}: VerifyArgs): Promise<SignupLinkResult> {
  // (1) Sanity client-side
  if (!sentSlug) {
    return {
      status: "missing_slug",
      sentSlug: null,
      expectedOrgId: null,
      actualOrgId: null,
      message:
        "No se envió organization_slug en el signup. El perfil quedará sin negocio asociado.",
    };
  }

  try {
    // (2) Resolver el org esperado por slug. Si el slug no existe, el trigger
    //     tampoco va a poder enlazar — útil distinguirlo del fallo de trigger.
    const { data: orgRow, error: orgErr } = await supabase
      .from("organizations")
      .select("id, slug, is_active")
      .eq("slug", sentSlug)
      .maybeSingle();

    if (orgErr) {
      return {
        status: "error",
        sentSlug,
        expectedOrgId: null,
        actualOrgId: null,
        message: `No se pudo resolver el slug "${sentSlug}": ${orgErr.message}`,
      };
    }
    if (!orgRow) {
      return {
        status: "unknown_slug",
        sentSlug,
        expectedOrgId: null,
        actualOrgId: null,
        message: `El slug "${sentSlug}" no existe en organizations. Revisa el subdominio.`,
      };
    }
    const expectedOrgId = orgRow.id as string;

    // (3) Polling sobre profiles. El trigger corre AFTER INSERT en auth.users,
    //     pero la nueva sesión puede no estar visible inmediatamente bajo RLS
    //     (signup sin email-confirm devuelve sesión; con confirm no). Por eso
    //     consultamos por email — `profiles.email` debe estar indexado.
    const deadline = Date.now() + timeoutMs;
    let lastActualOrgId: string | null = null;
    let profileSeen = false;

    while (Date.now() < deadline) {
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("organization_id, email")
        .eq("email", email)
        .maybeSingle();

      if (!profErr && profile) {
        profileSeen = true;
        lastActualOrgId = (profile as any).organization_id ?? null;
        if (lastActualOrgId === expectedOrgId) {
          return {
            status: "ok",
            sentSlug,
            expectedOrgId,
            actualOrgId: lastActualOrgId,
            message: `Cuenta enlazada correctamente a "${sentSlug}".`,
          };
        }
        if (lastActualOrgId && lastActualOrgId !== expectedOrgId) {
          return {
            status: "slug_mismatch",
            sentSlug,
            expectedOrgId,
            actualOrgId: lastActualOrgId,
            message: `El perfil quedó enlazado a otra organización (${lastActualOrgId}) en lugar de "${sentSlug}".`,
          };
        }
        // profile existe pero organization_id es null → seguir esperando
        // por si el trigger lo actualiza en un segundo paso.
      }
      await sleep(400);
    }

    if (!profileSeen) {
      return {
        status: "profile_not_created",
        sentSlug,
        expectedOrgId,
        actualOrgId: null,
        message:
          "El trigger no creó el perfil para este usuario (revisa handle_new_user).",
      };
    }
    if (!lastActualOrgId) {
      return {
        status: "organization_not_linked",
        sentSlug,
        expectedOrgId,
        actualOrgId: null,
        message:
          "El perfil se creó pero organization_id quedó vacío. El trigger no leyó el slug.",
      };
    }
    return {
      status: "timeout",
      sentSlug,
      expectedOrgId,
      actualOrgId: lastActualOrgId,
      message: "Tiempo de espera agotado validando el enlace al tenant.",
    };
  } catch (err: any) {
    return {
      status: "error",
      sentSlug,
      expectedOrgId: null,
      actualOrgId: null,
      message: err?.message || "Error inesperado validando signup tenant link.",
    };
  }
}
