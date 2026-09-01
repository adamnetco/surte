/**
 * SupabaseDesktopReleaseRepository — implementa `IDesktopReleaseRepository`
 * leyendo la tabla `desktop_releases` (release vigente por plataforma/canal).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  DesktopRelease,
  IDesktopReleaseRepository,
} from "@/core/ports/IDesktopReleaseRepository";

export const supabaseDesktopReleaseRepository: IDesktopReleaseRepository = {
  async getCurrent({ platform, channel = "stable" }): Promise<DesktopRelease | null> {
    const { data, error } = await supabase
      .from("desktop_releases")
      .select("version,platform,channel,download_url,release_notes,size_bytes,sha256,published_at")
      .eq("platform", platform)
      .eq("channel", channel)
      .eq("is_current", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      version: data.version,
      platform: data.platform,
      channel: data.channel,
      downloadUrl: data.download_url,
      releaseNotes: data.release_notes ?? null,
      sizeBytes: data.size_bytes ?? null,
      sha256: data.sha256 ?? null,
      publishedAt: data.published_at,
    };
  },
};
