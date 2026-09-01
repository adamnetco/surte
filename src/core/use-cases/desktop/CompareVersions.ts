/**
 * CompareVersions — lógica pura de comparación semver laxa (`1.4.0`, `v1.10.2`).
 * Se usa para decidir si un release publicado es más nuevo que el instalado.
 */
function parts(v: string): number[] {
  return String(v)
    .trim()
    .replace(/^v/i, "")
    .split(/[.\-+]/)
    .map((p) => Number.parseInt(p, 10))
    .filter((n) => Number.isFinite(n));
}

/** -1 si a < b, 0 si iguales, 1 si a > b. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** `true` cuando `candidate` es estrictamente más nueva que `installed`. */
export function isNewerVersion(candidate: string, installed: string): boolean {
  return compareVersions(candidate, installed) === 1;
}
