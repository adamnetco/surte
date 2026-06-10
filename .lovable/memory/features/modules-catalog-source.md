---
name: Modules catalog is DB-driven
description: Module toggles must read keys from public.modules, never hardcode
type: feature
---
La tabla `public.organization_modules` tiene FK a `public.modules(key)`. Cualquier UI que active/desactive módulos (superadmin OrganizationsTab, ModulesTab, etc.) DEBE cargar el catálogo desde `modules` (`is_active=true`, ordenado por `sort_order`, agrupado por `category`) en lugar de listas hardcodeadas. Keys válidas hoy: retail, horeca, pos, kds, mesas, inventario, agenda, spa, belleza, representantes, crm, licencias.

Errores anteriores nacían de keys inexistentes (`ecommerce`, `inventory`, `purchases`, `fiscal`, `whatsapp`, `pos_counter`) que rompían la FK `organization_modules_module_key_fkey`.

Aplicar update optimista en toggles y revertir vía `refetchModules()` si la mutación falla.
