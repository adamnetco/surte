# POS — Módulo Casas de Cambio (FX)

**Estado:** IN_BUILD (Slice 1 + 2 SHIPPED)
**Módulo nuevo:** `fx` (Foreign Exchange)
**`business_type` nuevo:** `casa_cambio` ✅ aplicado
**Módulo registry name:** `casas-de-cambio` ✅ aplicado

## Avance

- ✅ **Slice 1 — Schema + módulo registry** (migración aplicada): 5 tablas (fx_currencies, fx_pairs, fx_rates, fx_transactions, fx_audit_log) + RLS por organización + triggers de auditoría inmutable + business_type `casa_cambio` + columnas UIAF configurables en organizations + activación automática del módulo
- ✅ **Slice 2 — Configuración admin** (`/casas-de-cambio`): CRUD divisas con seed COP/USD/EUR/VES, creación de pares con auto-spread, registro de cotizaciones con histórico inmutable
- 🚧 Slice 3 — POS FX (pantalla de transacción + captura cliente + umbral UIAF)
- 🚧 Slice 4 — Caja multi-divisa
- 🚧 Slice 5 — Reportería + UIAF
- 🚧 Slice 6 — Reglas anti-fraude automáticas



## Problema

SistecPOS no atiende hoy a casas de cambio. Este vertical requiere:
- Multi-divisa nativa (no solo COP)
- Spread compra/venta por par de divisas
- Control regulatorio (UIAF, reportes Superfinanciera)
- Caja multi-moneda (denominaciones por divisa)
- Trazabilidad estricta (cada transacción auditada)

## Casos de uso día a día

1. **Cliente entra:** "Quiero cambiar USD 500 a COP" → cajero ve cotización del día (compra 4180 COP/USD), captura datos del cliente, recibe billetes USD, entrega COP 2.090.000, imprime soporte.
2. **Cliente entra:** "Quiero comprar USD 200 con COP" → cajero ve tasa venta (4220 COP/USD), recibe COP 844.000, entrega USD 200.
3. **Cierre de turno:** cajero hace arqueo por divisa (cuenta USD, EUR, COP por denominación). Diferencias se reportan.
4. **Reporte fin de mes:** admin descarga reporte UIAF con todas las operaciones > umbral.
5. **Operación sospechosa:** cajero marca transacción como ROS → genera reporte para Superfinanciera.

## Outcomes (Criterios de aceptación)

### Configuración
- [ ] **AC1:** Admin define divisas activas (USD, EUR, VES, etc.) en `fx_currencies`
- [ ] **AC2:** Admin define pares de cambio activos (USD/COP, EUR/COP, USD/EUR) en `fx_pairs`
- [ ] **AC3:** Cotización del día: tasa compra + tasa venta + spread automático
- [ ] **AC4:** Botón "Importar TRM" → trae tasa oficial Banco República (API pública)
- [ ] **AC5:** Histórico de cotizaciones (`fx_rates` con `effective_at`)

### Operación POS
- [ ] **AC6:** Pantalla `/pos/fx` con: par de divisas, monto origen, monto destino calculado, datos del cliente
- [ ] **AC7:** Si monto > umbral UIAF (USD 10K equiv): obligatorio capturar identificación completa (CC, nombre, dirección, ocupación, origen de fondos)
- [ ] **AC8:** Validación: monto debe coincidir con denominaciones disponibles en caja
- [ ] **AC9:** Al confirmar: descontar de caja origen, sumar a caja destino, registrar en `fx_transactions`
- [ ] **AC10:** Imprime soporte (recibo) con: tipo de operación, divisas, montos, tasa, cliente, cajero, hora

### Caja multi-divisa
- [ ] **AC11:** `cash_sessions` extendida para soportar múltiples saldos (uno por divisa)
- [ ] **AC12:** Arqueo de cierre pide conteo por denominación de cada divisa activa
- [ ] **AC13:** Diferencias se calculan por divisa y se registran en `cash_session_counts`

### Cumplimiento regulatorio
- [ ] **AC14:** Botón "Marcar como ROS" en transacción → captura motivo + observaciones
- [ ] **AC15:** Reporte UIAF mensual: CSV exportable con todas las operaciones > umbral
- [ ] **AC16:** Reporte ROS: PDF con formato Superfinanciera
- [ ] **AC17:** Audit log inmutable de todas las operaciones FX (no permitir UPDATE/DELETE)

### Reportería
- [ ] **AC18:** Dashboard FX: volumen del día por par, spread promedio, top clientes
- [ ] **AC19:** P&L: ganancia por spread por par, por turno, por cajero
- [ ] **AC20:** Histórico de tasas (gráfica 30/60/90 días)

## Schema DB nuevo

```sql
-- Divisas que la casa de cambio opera
CREATE TABLE fx_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,          -- ISO 4217: USD, EUR, COP, VES
  name TEXT NOT NULL,
  symbol TEXT,
  decimals SMALLINT DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Pares de cambio que la casa opera
CREATE TABLE fx_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  base_currency_id UUID NOT NULL REFERENCES fx_currencies(id),
  quote_currency_id UUID NOT NULL REFERENCES fx_currencies(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, base_currency_id, quote_currency_id)
);

-- Cotizaciones (compra/venta) con vigencia temporal
CREATE TABLE fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES fx_pairs(id) ON DELETE CASCADE,
  buy_rate NUMERIC(18,6) NOT NULL,   -- Tasa a la que la casa COMPRA divisa base
  sell_rate NUMERIC(18,6) NOT NULL,  -- Tasa a la que la casa VENDE divisa base
  source TEXT DEFAULT 'manual',      -- 'manual' | 'trm_banrep' | 'api'
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transacciones FX
CREATE TABLE fx_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  cash_session_id UUID REFERENCES cash_sessions(id),
  pair_id UUID NOT NULL REFERENCES fx_pairs(id),
  operation TEXT NOT NULL CHECK (operation IN ('buy','sell')), -- desde POV casa
  from_currency_id UUID NOT NULL REFERENCES fx_currencies(id),
  to_currency_id UUID NOT NULL REFERENCES fx_currencies(id),
  from_amount NUMERIC(18,2) NOT NULL,
  to_amount NUMERIC(18,2) NOT NULL,
  rate_applied NUMERIC(18,6) NOT NULL,
  customer_doc_type TEXT,
  customer_doc_number TEXT,
  customer_name TEXT,
  customer_address TEXT,
  customer_occupation TEXT,
  funds_origin TEXT,
  is_above_threshold BOOLEAN DEFAULT false,
  is_suspicious BOOLEAN DEFAULT false,
  ros_reason TEXT,
  cashier_id UUID REFERENCES auth.users(id),
  receipt_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico inmutable (no permitir UPDATE/DELETE vía RLS)
CREATE TABLE fx_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  transaction_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB,
  actor_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Pendiente de definir antes de empezar

1. **Umbral UIAF exacto:** ¿USD 10.000 equivalente o COP 50 millones?
2. **Integración TRM:** ¿API Banrep oficial o scraping?
3. **¿Soporte multi-sucursal con tasas diferentes** o tasa única por organización?
4. **¿Caja FX comparte la misma `cash_session` con la caja de ventas regulares** o sesiones separadas?
5. **¿Imprimir soporte fiscal (factura electrónica DIAN)** o solo recibo interno? (Requiere Innapsis listo)
6. **¿Reglas de antifraude automáticas** (ej. mismo cliente 3 operaciones en 1 día → alerta) o solo manual?

## Tareas (vertical slices)

### Slice 1 — Schema + módulo registry
- Migración con 5 tablas + RLS + GRANTs
- Registrar `casas-de-cambio` en módulos disponibles
- Seed: divisas y pares default (USD/COP, EUR/COP)

### Slice 2 — Configuración admin
- `/admin/fx/divisas` — CRUD divisas
- `/admin/fx/pares` — CRUD pares
- `/admin/fx/cotizaciones` — set tasas + importar TRM

### Slice 3 — POS FX
- `/pos/fx` — pantalla de transacción
- Validación umbral UIAF
- Captura datos cliente extendida
- Print recibo

### Slice 4 — Caja multi-divisa
- Extender `cash_sessions` con `balances JSONB`
- UI de arqueo multi-divisa
- Cálculo de diferencias por divisa

### Slice 5 — Reportería + UIAF
- Dashboard FX
- Exportación UIAF mensual
- Generador ROS PDF

### Slice 6 — Audit inmutable
- Trigger que copia toda operación a `fx_audit_log`
- RLS que niega UPDATE/DELETE en `fx_audit_log`

## No-objetivos

- ❌ Trading P2P entre clientes
- ❌ Wallet digital / crypto
- ❌ Remesas internacionales (otro vertical)
- ❌ Conexión a SWIFT
