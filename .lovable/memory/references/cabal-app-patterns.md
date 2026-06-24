---
name: Cabal-app — UX patterns, admin panel & flows
description: 15 capturas web.cabal-app.com — sidebar agrupado por dominio (PDV/Organizaciones/Contabilidad), "Tu cuenta" con tabs General/Plus/Integraciones/API Key/Password, suscripción Plus con trial 6 días + estado en panel, Pedidos como Kanban board (Entrantes/En progreso/Finalizados), Corte de caja con desglose ventas (contado/transferencias/órdenes web/crédito), login Google+Apple, programa referidos 40%, tutoriales YouTube embebidos. Eduardo destaca panel admin limpio y personalizable.
type: reference
---

# Cabal-app (web.cabal-app.com) — Análisis UX

15 capturas. Eduardo destaca **simplicidad, claridad de flujo y panel administrativo personalizable**.

## Stack visual observado
- Logo "cabal." minúscula con punto → branding casual/cercano
- Sidebar oscuro/claro con secciones colapsables, items con icono+label
- Color accent **morado/violeta** en CTAs principales
- Espaciado generoso, tipografía sans clara, sin densidad excesiva
- App web responsiva (`webcabal-app.com/dashboard/pdv/nueva-venta` URL pattern)

## Arquitectura de información (sidebar — CAP 02, 07, 14)

Sidebar agrupado por **dominios de negocio** (no por entidades CRUD):

```
MÓDULOS
  Tutoriales
  Inicio (Dashboard)

PUNTO DE VENTA (POV)
  Venta mostrador
  Pedidos
  Productos    >
  Servicios    >
  Adicionales  ▾
  Analíticas POV

ORGANIZACIONES
  Mis organizaciones
  Roles y permisos  ▾

CONTABILIDAD
  Contabilidad
  Inventario
  Empleados
```

**Insight clave**: separan POV de Contabilidad como dos universos. Un cajero solo ve POV. Un admin ve ambos. **Esto es lo que Eduardo llama "panel personalizable"** → secciones se muestran/ocultan por rol.

**Réplica SistecPOS**:
- Sidebar `<Collapsible>` shadcn por grupo (POV / Backoffice / Org)
- Filtrar grupos completos por permisos, no solo items
- Recordar estado colapsado en `localStorage`

## "Tu cuenta" — panel admin con tabs (CAP 02, 07, 08, 12)

Patrón **tabs horizontales** en página `/dashboard/tu-cuenta`:
1. **General** — datos personales (nombre, apellido, teléfono, email, sesión activa)
2. **Cabal Plus** — estado suscripción (trial 6 días, fecha inicio/fin/próximo pago, botón cancelar)
3. **Integraciones** — conexiones externas
4. **API Key** — token developer (CAP 12) — `0GLaFINOC...`
5. **Cambiar Contraseña** — actual / nueva / confirmar (3 inputs)

**Por qué es limpio**:
- Una sola URL `/tu-cuenta`, tabs cambian contenido sin recarga
- Cada tab = una responsabilidad clara
- API Key visible para usuarios técnicos = ventaja competitiva (POSCOL y VectorPOS no la exponen)

**Réplica SistecPOS**:
- `/admin/mi-cuenta` con `<Tabs>` shadcn: Perfil / Plan / Integraciones / API / Seguridad
- API Key con copy-to-clipboard + regenerar (ya tienen patrón)
- Estado plan en banner persistente top si trial < 7 días

## Pedidos = Kanban board (CAP 15) — JOYA

`/pedidos` muestra **tres columnas Kanban**:
- **Entrantes** | **En progreso** | **Finalizados**
- Cada columna con tarjetas de pedido
- Footer columna: `[Anterior] [Siguiente]` + **Cargar más** (paginación por columna, no scroll infinito → mantiene rendimiento)

**Por qué funciona**:
- Flujo de pedidos = pipeline visual (drag entre columnas implícito o por botón)
- Mejor que tabla con filtros para alta rotación
- Patrón **Trello/Linear** familiar

**Réplica SistecPOS**:
- `/admin/pedidos` con vista toggle **Tabla ↔ Kanban**
- Kanban columnas configurables por organización (HORECA: Recibido/En cocina/Listo/Entregado)
- Cargar más por columna (mismo patrón)
- Realtime: nuevos pedidos entran a "Entrantes" con highlight

## Corte de caja avanzado (CAP 05, 09, 13)

Selector de rango temporal **Diario** (también semanal/mensual implícito) + desglose categorizado:

```
Inyección de efectivo            $X
Ventas al contado:
  Efectivo                       $X
  Transferencias                 $X
  Tarjeta                        $X
  Órdenes web                    $X       ← canal aparte
  Total                          $X
Ventas al crédito                $X
Abonos por transferencias        $X
Abonos por tarjeta               $X
Gastos / compras al crédito      $X
Total gastos / compras           $X
Cargos por transferencias        $X     ← comisiones bancarias
Cargos por tarjeta               $X
```

**Insights clave**:
1. **Órdenes web** ya separado como canal — coincide con tu decisión Marketplace=channel propio
2. **Cargos por transferencia/tarjeta** = comisiones pasarela restadas explícitamente → margen real visible
3. **Inyección de efectivo** = registro de aportes extra durante el turno (no solo apertura)
4. **Abonos al crédito** separados de ventas → cartera trackeada
5. Rango temporal en el mismo cierre — permite cerrar día sin perder vista de la semana

**Réplica SistecPOS**:
- En `CloseSessionDialog` agregar:
  - `cash_injections` durante turno
  - Categorizar canales (efectivo/transferencia/tarjeta/web)
  - Restar comisiones por canal (config en `payment_methods.commission_pct`)
  - Mostrar también abonos a créditos del día

## Venta mostrador (CAP 01, 06)

Layout 2 columnas:
- **Izquierda (~65%)**: grid productos con filtros arriba `Nombre | Categorías | Ordenar por`
- **Derecha (~35%)**: ticket con `Subtotal $0.00`, scroll items, `Total` abajo, botones `Cancelar` / `Cobrar`

Header tiene banner **"Debes seleccionar al menos 1 producto o marcar 'Todos los productos'"** → validación inline persistente, no toast efímero.

Banner azul **"En el Punto de Venta podrás realizar ventas al contado..."** = onboarding contextual.

**Réplica SistecPOS**:
- Validaciones inline persistentes (banner amarillo) en flujos críticos, no solo toasts
- Onboarding contextual descartable por usuario

## Login (CAP 10)

- Email + password tradicional
- **Sign in with Google** + **Continue with Apple** (SSO doble)
- Toggle idioma `Español | English` inline
- Sidebar derecho con CTA **"¡Gana con Cabal! Refiere a otros... 40%"** → programa de referidos prominente en login

**Réplica SistecPOS**:
- Agregar Apple SSO además de Google (ya configurado)
- i18n EN como segundo idioma
- Programa de referidos en página marketing (no en login Core, distrae)

## Tutoriales embebidos (CAP 03, 04)

YouTube playlists embebidos en `/tutoriales` con categorías:
- Nueva actualización mayo 2026
- Cabal Academy
- Programa de afiliados
- ¿Qué es Cabal App?
- Tutoriales versión gratuita - App móvil
- Tutoriales Plus - Cabal Web
- Aprende Cabal - Conceptos financieros

**Insight**: el botón **Tutoriales es la PRIMERA opción del sidebar** → educación = pilar de retención. Reduce tickets de soporte.

**Réplica SistecPOS**:
- `/admin/tutoriales` con playlist YouTube + categorías por módulo
- Link en sidebar arriba de todo
- Tooltip "?" en headers críticos que abren video específico

## Suscripción Plus (CAP 07)

Panel suscripción muestra:
- Plan actual: "An." (Anual?) $0.00 trial
- Estado: "Prueba gratuita (6 días disponibles)"
- Fechas: inicio / finalización / próximo pago
- Nota: "Para cancelar tu suscripción visita la tienda (Google Play o App Store) de tu dispositivo móvil" → cancelación delegada a la app store (limita LTV pero cumple políticas)

**Réplica SistecPOS**:
- Banner trial countdown
- Cancelación in-app (no delegar a stores → mejor LTV)

## API Key (CAP 12) — diferenciador

Sección dedicada en `/tu-cuenta` con token visible.
**Cabal expone API a usuarios finales** = developers/integradores pueden conectar.

**Réplica SistecPOS**:
- Sección API Keys con scopes (read products / write orders / etc)
- Regenerar + revocar
- Webhooks endpoint config en la misma página

## Resumen — patrones a adoptar prioritariamente

| Patrón Cabal | Acción SistecPOS | Prioridad |
|---|---|---|
| Sidebar agrupado por dominios | Refactor `AdminSidebar` con `<Collapsible>` por grupo | **Alta** |
| `/mi-cuenta` con tabs (Perfil/Plan/Integraciones/API/Seguridad) | Crear página única | **Alta** |
| Pedidos como Kanban (Entrantes/Progreso/Finalizados) | Toggle vista Tabla↔Kanban en `/admin/pedidos` | Alta |
| Corte de caja con canales + comisiones + abonos | Extender `CloseSessionDialog` | **Alta HORECA** |
| Tutoriales embebidos en sidebar top | `/admin/tutoriales` con YouTube playlists | Media |
| Validación inline persistente (banner) | Patrón compartido `<InlineValidationBanner>` | Media |
| API Key + Webhooks autoservicio | Tab API en mi-cuenta | Media (post-pilot) |
| Apple SSO + i18n EN | Auth config | Baja |
| Programa referidos 40% | Página marketing | Baja |

## Anti-patrones Cabal
- Cancelación de suscripción delegada a Apple/Google Store (pierden LTV)
- Algunas pantallas con encoding/render roto (CAP 11 vacía, CAP 09 texto encimado) → falta QA
- Sidebar muy alto sin truncar bien en viewports cortos
- Layout PDV con header informativo grande que **roba espacio** al grid productos → en pantallas táctiles 10" es problema

## Comparación cruzada
| Criterio | VectorPOS | POSCOL | Cabal | SistecPOS objetivo |
|---|---|---|---|---|
| Arquitectura info | Tabs flat | Module grid | Sidebar agrupado | **Sidebar agrupado + module grid landing** |
| Mi cuenta | Disperso | Disperso | Tabs unificadas ✅ | Copiar Cabal |
| Pedidos | Lista | Tabla | **Kanban** ✅ | Toggle Tabla↔Kanban |
| Corte caja | Vista lectura | 1-input apertura | Desglose canales+comisiones ✅ | Copiar Cabal |
| Tutoriales | No visible | Soporte estático | YouTube embebido ✅ | Copiar Cabal |
| API pública | No | No | **Sí, autoservicio** ✅ | Diferenciador |
| Multi-org | Limitado | No | Sí, nativo | Ya tenemos |
