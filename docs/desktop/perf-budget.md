# Presupuesto de rendimiento (CI)

Cierra el pendiente listado en `docs/desktop/slice-5-tauri-decision.md`: evitar que
el POS se degrade en terminales de caja modestas sin necesidad de migrar a Tauri.

## Qué se mide

`scripts/perf-budget.mjs` corre después de `npm run build` y evalúa el bundle real:

| Métrica | Significado | Límite actual |
| --- | --- | --- |
| `totalJsGzipKb` | Suma de todo el JS servido (gzip) | 1750 |
| `totalCssGzipKb` | Suma del CSS (gzip) | 40 |
| `largestJsChunkGzipKb` | Chunk más grande — proxy directo del LCP | 420 |
| `distRawMb` | Peso total de `dist/` (afecta al precache del service worker) | 7.5 |

Los límites viven en `perf-budget.json`, con ~8 % de holgura sobre la medición del
2026-03-31 (JS 1604.7 KB gz, chunk mayor 379.8 KB gz).

## Cómo se ejecuta

- CI: workflow `.github/workflows/perf-budget.yml` en cada push a `main` y en cada PR.
- Local: `npm run build && npm run perf:budget`.
- Recalibrar: `node scripts/perf-budget.mjs --update` y justificar el cambio en el PR.

## Si el gate falla

1. Revisa el chunk señalado en la salida del script.
2. Prefiere `import()` dinámico para vistas admin, diálogos pesados y dependencias
   de reportes antes que subir el límite.
3. Solo sube el límite cuando el peso extra sea funcionalidad necesaria en el
   arranque del POS, y documenta la razón aquí.

## Fuera de alcance por ahora

El LCP medido en navegador (Lighthouse/Playwright) queda pendiente: el gate de
bundle es determinista en CI, mientras que el LCP en runners compartidos es
ruidoso. Se añadirá al suite nocturno si el bundle deja de ser el factor dominante.
