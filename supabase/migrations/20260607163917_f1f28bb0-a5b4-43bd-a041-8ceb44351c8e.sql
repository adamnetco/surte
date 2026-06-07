ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS bluetooth_address text,
  ADD COLUMN IF NOT EXISTS os_printer_name text;

COMMENT ON COLUMN public.printers.bluetooth_address IS 'MAC BLE para emparejamiento persistente desde el agente (noble)';
COMMENT ON COLUMN public.printers.os_printer_name IS 'Nombre de la impresora instalada en el SO (Windows/macOS/Linux) para fallback de spooler RAW';