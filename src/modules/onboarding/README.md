# Onboarding module

UI primitives y plantillas para el flujo de onboarding (Dueño y Superadmin).

## Estructura
- `components/WizardShell.tsx` — shell visual de pasos.
- `components/SubdomainPreview.tsx` — input + verificación de slug.
- `components/NitLookup.tsx` — autocompletar por NIT (fallback manual).
- `components/CredentialsCard.tsx` — pantalla final con credenciales (mailto/wa.me).
- `lib/businessTemplates.ts` — plantillas por tipo de negocio + módulos.

## Reglas
- No deep imports: usar `@/modules/onboarding`.
- Solo presentación + tipos; sin reglas de negocio del POS.
- Edge functions relacionadas: `tenant-create-with-owner`, `nit-lookup`.

## Próximo módulo sugerido
`lib/cartToken` o consolidar `hooks/` sueltos (`useStore`, `useFavorites`, `useFeatureFlag`).
