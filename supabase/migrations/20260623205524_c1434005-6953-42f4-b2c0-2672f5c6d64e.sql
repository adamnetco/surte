-- Habilitar Realtime para alertas anti-fraude FX
ALTER TABLE public.fx_fraud_alerts REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.fx_fraud_alerts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;