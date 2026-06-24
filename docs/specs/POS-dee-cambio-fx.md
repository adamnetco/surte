# POS — DEE Cambio (Documento Equivalente Electrónico para Casas de Cambio)

**Estado:** DRAFT — bloqueado por coordinación con Innapsis
**Módulo:** `fx` (consumidor) + `admin-cms` (config) + edge `innapsis-emit` (extender)
**Wave:** 1.5 — Innapsis Electronic Billing — extensión FX
**Spec relacionado:** [POS-innapsis-emision-pos.md](./POS-innapsis-emision-pos.md), [POS-casas-de-cambio.md](./POS-casas-de-cambio.md)
**Código DIAN:** tipo de documento `15` (DEE-09 — operaciones de cambio)
**Marco legal:** Res. DIAN 000165/2023 Art. 13 num. 9 + Decreto 358/2020 + Circular Reglamentaria DCIN-83 (Banco República)

## Problema

Ningún competidor analizado (Alegra, Siigo, Vector, Cabal, POSCOL, FacilPOS) emite **Documento Equivalente Electrónico para operaciones de cambio (DEE-09)**. Las casas de cambio en Colombia hoy:

- Operan con recibos manuales no electrónicos → riesgo sancionatorio DIAN.
- Reportan manualmente al Banco de la República (formato DCIN-83) → alta carga operativa.
- Reportan manualmente a UIAF cuando aplica (cash ≥ 10M COP o múltiples ≥ 50M COP/mes).

SistecPOS ya tiene `fx_transactions` con todos los datos requeridos. Falta el puente DIAN + BanRep + UIAF.

## Outcomes

### Emisión DEE-09 al cerrar transacción FX
- [ ] **AC1:** Al confirmar una `fx_transaction` (compra/venta de divisa), se encola un `einvoice_emit` con `doc_type = 'dee_cambio'`.
- [ ] **AC2:** El payload incluye: tipo operación (compra/venta), divisa, monto divisa, TRM aplicada, comisión, monto COP, identificación cliente (CC/CE/Pasaporte) **obligatoria si > 200 USD equivalentes**, dirección si > 1000 USD.
- [ ] **AC3:** `innapsis-emit` enruta a endpoint Innapsis con `tipo_documento=15` (pendiente confirmar disponibilidad API v1.9).
- [ ] **AC4:** Respuesta DIAN aceptada → CUFE persistido en `electronic_invoices.cufe` + link a `fx_transactions.einvoice_id`.

### Reporte BanRep (DCIN-83)
- [ ] **AC5:** Job semanal genera archivo plano DCIN-83 con todas las operaciones del período + lo sube a SFTP de BanRep (credenciales por org en `fx_banrep_config`).
- [ ] **AC6:** Dashboard `/admin/fx/reportes-banrep` muestra estado de cada envío (pending/sent/accepted/rejected) y permite re-generación manual.

### Reporte UIAF (ROS/RTE)
- [ ] **AC7:** Trigger automático cuando una operación supera umbrales UIAF (cash ≥ 10M COP single o ≥ 50M COP acumulado mes) → crea `uiaf_pending_report` con estado `draft`.
- [ ] **AC8:** Compliance officer revisa en `/admin/fx/uiaf` y confirma → genera XML UIAF y queda log auditable.

### UX cajero FX
- [ ] **AC9:** En el dialog de confirmación FX, badge en vivo de estado DEE (reutiliza `EinvoiceStatusBadge`).
- [ ] **AC10:** Si el cliente NO presentó ID y la operación es > 200 USD → bloquear confirmación con mensaje legal explícito.
- [ ] **AC11:** Print template específico: encabezado "DOCUMENTO EQUIVALENTE ELECTRÓNICO - OPERACIÓN DE CAMBIO", TRM, comisión desglosada, leyenda legal Res. 000165.

### Configuración por organización
- [ ] **AC12:** En `/admin/fx/configuracion`, sección "Reportes regulatorios": credenciales SFTP BanRep, código compañía cambiaria, datos compliance officer UIAF.
- [ ] **AC13:** Tipo de documento `dee_cambio` aparece automáticamente en `organization_document_types` cuando se activa módulo `fx`.

## Schema DB (incremental)

```sql
-- depende del catálogo dinámico introducido en POS-innapsis-emision-pos slice 2A+2B
INSERT INTO document_types (code, family, dian_code, label, goes_to_dian, requires_resolution, applies_to_modules)
VALUES ('dee_cambio', 'equivalente', '15', 'DEE - Operación de cambio', true, true, ARRAY['fx']);

ALTER TABLE fx_transactions
  ADD COLUMN einvoice_id UUID REFERENCES electronic_invoices(id),
  ADD COLUMN customer_id_type TEXT,    -- CC / CE / PA / TI
  ADD COLUMN customer_id_number TEXT,
  ADD COLUMN customer_address TEXT,    -- requerido si > 1000 USD
  ADD COLUMN banrep_report_id UUID,
  ADD COLUMN uiaf_flag BOOLEAN DEFAULT false;

CREATE TABLE fx_banrep_config (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  compania_cambiaria_code TEXT NOT NULL,
  sftp_host TEXT,
  sftp_user TEXT,
  sftp_password_encrypted TEXT,
  reporting_frequency TEXT DEFAULT 'weekly',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fx_banrep_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_path TEXT,
  operations_count INTEGER,
  sent_at TIMESTAMPTZ,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE uiaf_pending_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fx_transaction_id UUID REFERENCES fx_transactions(id),
  threshold_triggered TEXT NOT NULL,   -- single_10m / accumulated_50m
  status TEXT DEFAULT 'draft',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  xml_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- GRANTS + RLS estándar multi-tenant (omitidos por brevedad — ver patterns.md)
```

## Bloqueadores externos

1. **Innapsis API v1.9 — confirmar soporte `tipo_documento=15`** (DEE-09). Si no soporta, escalar para roadmap Innapsis.
2. **BanRep DCIN-83 — credenciales SFTP por compañía cambiaria.** Cada tenant debe tramitar su acceso.
3. **UIAF — registro previo del reportante** ante UIAF. Es responsabilidad del tenant, SistecPOS solo emite el archivo.

## Métricas de éxito

- 100% de operaciones FX > 0 COP emiten DEE-09 con CUFE válido.
- Reporte BanRep semanal automático sin intervención manual en 95% de los casos.
- 0 sanciones DIAN/BanRep/UIAF por incumplimiento en clientes activos.

## Fuera de scope (v1.0)

- Multi-divisa simultánea en una sola operación (cross-currency).
- Soporte para Cambistas Profesionales No Cambiarios (otra normativa).
- Integración con corresponsales cambiarios.

## Estado de coordinación Innapsis

- [ ] Enviar email a Innapsis solicitando: (a) confirmación soporte `tipo_documento=15`, (b) ejemplo XML DEE-09 firmado, (c) ambiente de pruebas con resolución de prueba para DEE.
- [ ] Documentar respuesta en `docs/specs/innapsis/dee-cambio-api.md`.
- [ ] Solo cuando Innapsis confirme → mover a `IN_SPEC`.
