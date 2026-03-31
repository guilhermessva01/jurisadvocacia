
-- Add cycle_start_date to office_settings
ALTER TABLE public.office_settings ADD COLUMN IF NOT EXISTS cycle_start_date date DEFAULT CURRENT_DATE;

-- Update existing row with today as cycle start
UPDATE public.office_settings SET cycle_start_date = '2026-03-30';

-- Insert 2 blank branch offices
INSERT INTO public.office_settings (office_name, address, latitude, longitude, radius_meters, cycle_start_date)
VALUES
  ('Filial 1', NULL, 0, 0, 50, '2026-03-30'),
  ('Filial 2', NULL, 0, 0, 50, '2026-03-30');
