
-- ============== fx_fraud_rules ==============
CREATE TABLE public.fx_fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_mark_suspicious BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, rule_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_fraud_rules TO authenticated;
GRANT ALL ON public.fx_fraud_rules TO service_role;
ALTER TABLE public.fx_fraud_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_fraud_rules_admin_manage" ON public.fx_fraud_rules
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','superadmin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','superadmin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "fx_fraud_rules_member_read" ON public.fx_fraud_rules
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE INDEX idx_fx_fraud_rules_org ON public.fx_fraud_rules(organization_id, is_active);

-- ============== fx_fraud_watchlist ==============
CREATE TABLE public.fx_fraud_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc_type TEXT,
  doc_number TEXT NOT NULL,
  full_name TEXT,
  reason TEXT,
  added_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, doc_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_fraud_watchlist TO authenticated;
GRANT ALL ON public.fx_fraud_watchlist TO service_role;
ALTER TABLE public.fx_fraud_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_fraud_watchlist_admin_manage" ON public.fx_fraud_watchlist
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','superadmin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','superadmin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "fx_fraud_watchlist_member_read" ON public.fx_fraud_watchlist
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE INDEX idx_fx_fraud_watchlist_doc ON public.fx_fraud_watchlist(organization_id, doc_number) WHERE is_active = true;

-- ============== fx_fraud_alerts ==============
CREATE TABLE public.fx_fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.fx_transactions(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.fx_fraud_rules(id) ON DELETE SET NULL,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','escalated')),
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_fraud_alerts TO authenticated;
GRANT ALL ON public.fx_fraud_alerts TO service_role;
ALTER TABLE public.fx_fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_fraud_alerts_admin_manage" ON public.fx_fraud_alerts
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','superadmin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin','superadmin')
    )
    OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE POLICY "fx_fraud_alerts_member_read" ON public.fx_fraud_alerts
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE INDEX idx_fx_fraud_alerts_org_status ON public.fx_fraud_alerts(organization_id, status, created_at DESC);
CREATE INDEX idx_fx_fraud_alerts_tx ON public.fx_fraud_alerts(transaction_id);

-- ============== updated_at triggers ==============
CREATE TRIGGER trg_fx_fraud_rules_updated BEFORE UPDATE ON public.fx_fraud_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fx_fraud_watchlist_updated BEFORE UPDATE ON public.fx_fraud_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fx_fraud_alerts_updated BEFORE UPDATE ON public.fx_fraud_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== Evaluator function + trigger ==============
CREATE OR REPLACE FUNCTION public.fx_evaluate_fraud_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_count INT;
  v_sum NUMERIC;
  v_threshold NUMERIC;
  v_window_minutes INT;
  v_max_ops INT;
  v_should_flag BOOLEAN := false;
  v_reason TEXT;
  v_details JSONB;
  v_watch RECORD;
BEGIN
  -- Watchlist (always evaluated even without explicit rule)
  IF NEW.customer_doc_number IS NOT NULL THEN
    SELECT * INTO v_watch FROM public.fx_fraud_watchlist
    WHERE organization_id = NEW.organization_id
      AND doc_number = NEW.customer_doc_number
      AND is_active = true
    LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.fx_fraud_alerts (organization_id, transaction_id, rule_code, severity, reason, details)
      VALUES (NEW.organization_id, NEW.id, 'watchlist_match', 'critical',
              'Cliente en lista de vigilancia: ' || COALESCE(v_watch.reason, 'sin motivo'),
              jsonb_build_object('doc_number', NEW.customer_doc_number, 'watchlist_id', v_watch.id));
      v_should_flag := true;
    END IF;
  END IF;

  -- Iterate active rules
  FOR v_rule IN
    SELECT * FROM public.fx_fraud_rules
    WHERE organization_id = NEW.organization_id AND is_active = true
  LOOP
    v_reason := NULL;
    v_details := '{}'::jsonb;

    IF v_rule.rule_code = 'structuring_daily_count' THEN
      -- Same customer N+ operations in a day
      v_max_ops := COALESCE((v_rule.params->>'max_ops_per_day')::int, 3);
      IF NEW.customer_doc_number IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.fx_transactions
        WHERE organization_id = NEW.organization_id
          AND customer_doc_number = NEW.customer_doc_number
          AND created_at >= date_trunc('day', NEW.created_at)
          AND created_at <= NEW.created_at;
        IF v_count >= v_max_ops THEN
          v_reason := 'Cliente con ' || v_count || ' operaciones en el día (umbral: ' || v_max_ops || ')';
          v_details := jsonb_build_object('operations_today', v_count, 'threshold', v_max_ops, 'doc_number', NEW.customer_doc_number);
        END IF;
      END IF;

    ELSIF v_rule.rule_code = 'structuring_daily_amount' THEN
      -- Cumulative amount per day per customer above threshold (in COP equivalent via to_amount when to=COP)
      v_threshold := COALESCE((v_rule.params->>'max_amount_per_day_cop')::numeric, 50000000);
      IF NEW.customer_doc_number IS NOT NULL THEN
        SELECT COALESCE(SUM(
          CASE WHEN fc.code = 'COP' THEN t.to_amount
               ELSE t.from_amount * t.rate_applied END
        ), 0) INTO v_sum
        FROM public.fx_transactions t
        JOIN public.fx_currencies fc ON fc.id = t.to_currency_id
        WHERE t.organization_id = NEW.organization_id
          AND t.customer_doc_number = NEW.customer_doc_number
          AND t.created_at >= date_trunc('day', NEW.created_at)
          AND t.created_at <= NEW.created_at;
        IF v_sum >= v_threshold THEN
          v_reason := 'Acumulado diario del cliente COP ' || v_sum::text || ' supera umbral ' || v_threshold::text;
          v_details := jsonb_build_object('sum_cop', v_sum, 'threshold_cop', v_threshold, 'doc_number', NEW.customer_doc_number);
        END IF;
      END IF;

    ELSIF v_rule.rule_code = 'rapid_operations' THEN
      -- N+ operations in a short window
      v_max_ops := COALESCE((v_rule.params->>'max_ops')::int, 5);
      v_window_minutes := COALESCE((v_rule.params->>'window_minutes')::int, 60);
      IF NEW.customer_doc_number IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.fx_transactions
        WHERE organization_id = NEW.organization_id
          AND customer_doc_number = NEW.customer_doc_number
          AND created_at >= (NEW.created_at - (v_window_minutes || ' minutes')::interval)
          AND created_at <= NEW.created_at;
        IF v_count >= v_max_ops THEN
          v_reason := v_count || ' operaciones en ' || v_window_minutes || ' minutos';
          v_details := jsonb_build_object('count', v_count, 'window_minutes', v_window_minutes, 'doc_number', NEW.customer_doc_number);
        END IF;
      END IF;

    ELSIF v_rule.rule_code = 'large_single_op' THEN
      -- Single op above threshold
      v_threshold := COALESCE((v_rule.params->>'threshold_cop')::numeric, 40000000);
      DECLARE v_op_cop NUMERIC;
      BEGIN
        SELECT CASE WHEN fc.code = 'COP' THEN NEW.to_amount
                    ELSE NEW.from_amount * NEW.rate_applied END
        INTO v_op_cop
        FROM public.fx_currencies fc WHERE fc.id = NEW.to_currency_id;
        IF v_op_cop >= v_threshold THEN
          v_reason := 'Operación individual COP ' || v_op_cop::text || ' supera umbral ' || v_threshold::text;
          v_details := jsonb_build_object('amount_cop', v_op_cop, 'threshold_cop', v_threshold);
        END IF;
      END;

    ELSIF v_rule.rule_code = 'missing_customer_data' THEN
      -- Above-threshold op without full customer data
      IF NEW.is_above_threshold = true AND (
        NEW.customer_doc_number IS NULL OR NEW.customer_name IS NULL
        OR NEW.customer_address IS NULL OR NEW.customer_occupation IS NULL
        OR NEW.funds_origin IS NULL
      ) THEN
        v_reason := 'Operación sobre umbral UIAF sin datos completos del cliente';
        v_details := jsonb_build_object(
          'has_doc', NEW.customer_doc_number IS NOT NULL,
          'has_name', NEW.customer_name IS NOT NULL,
          'has_address', NEW.customer_address IS NOT NULL,
          'has_occupation', NEW.customer_occupation IS NOT NULL,
          'has_funds_origin', NEW.funds_origin IS NOT NULL
        );
      END IF;
    END IF;

    IF v_reason IS NOT NULL THEN
      INSERT INTO public.fx_fraud_alerts (
        organization_id, transaction_id, rule_id, rule_code, severity, reason, details
      ) VALUES (
        NEW.organization_id, NEW.id, v_rule.id, v_rule.rule_code, v_rule.severity, v_reason, v_details
      );
      IF v_rule.auto_mark_suspicious OR v_rule.severity IN ('high','critical') THEN
        v_should_flag := true;
      END IF;
    END IF;
  END LOOP;

  IF v_should_flag AND NEW.is_suspicious = false THEN
    UPDATE public.fx_transactions
    SET is_suspicious = true,
        ros_reason = COALESCE(ros_reason, 'Marcado automáticamente por reglas anti-fraude')
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fx_evaluate_fraud_rules ON public.fx_transactions;
CREATE TRIGGER trg_fx_evaluate_fraud_rules
  AFTER INSERT ON public.fx_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fx_evaluate_fraud_rules();
