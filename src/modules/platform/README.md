# Platform module

Utilidades transversales sin dominio de negocio (feature flags, etc.).

## Estructura
- `hooks/useFeatureFlag.ts` — lectura de banderas en `feature_flags` para refactor por etapas.

## Reglas
- No depende de ningún otro módulo de negocio.
- Si un util crece, evaluar moverlo al módulo dueño.
