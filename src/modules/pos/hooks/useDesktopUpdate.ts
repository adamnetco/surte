import { useCallback, useEffect, useState } from "react";
import { getDesktopBridge } from "@/infrastructure/desktop/ElectronDesktopBridge";
import { supabaseDesktopReleaseRepository } from "@/infrastructure/database/SupabaseDesktopReleaseRepository";
import { isNewerVersion } from "@/core/use-cases/desktop/CompareVersions";
import { APP_VERSION } from "@/lib/version";
import type { DesktopRelease } from "@/core/ports/IDesktopReleaseRepository";

export interface DesktopUpdateState {
  checking: boolean;
  installedVersion: string;
  latest: DesktopRelease | null;
  updateAvailable: boolean;
  recheck: () => void;
}

/**
 * Consulta el release vigente para la plataforma actual y determina si hay
 * una versión más nueva que la instalada. Solo tiene sentido en el cliente
 * de escritorio; en web se resuelve igual pero se informa como "al día".
 */
export function useDesktopUpdate(enabled = true): DesktopUpdateState {
  const bridge = getDesktopBridge();
  const { platform, appVersion } = bridge.getPlatform();
  const installedVersion = appVersion ?? APP_VERSION;

  const [checking, setChecking] = useState(false);
  const [latest, setLatest] = useState<DesktopRelease | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled || platform === "web") { setLatest(null); return; }
    let cancelled = false;
    setChecking(true);
    supabaseDesktopReleaseRepository
      .getCurrent({ platform })
      .then((rel) => { if (!cancelled) setLatest(rel); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [enabled, platform, nonce]);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  return {
    checking,
    installedVersion,
    latest,
    updateAvailable: !!latest && isNewerVersion(latest.version, installedVersion),
    recheck,
  };
}
