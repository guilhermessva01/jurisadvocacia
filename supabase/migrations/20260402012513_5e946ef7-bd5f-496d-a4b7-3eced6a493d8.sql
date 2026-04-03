
-- Add shift_index column to work_schedules if not exists
ALTER TABLE public.work_schedules ADD COLUMN IF NOT EXISTS shift_index integer NOT NULL DEFAULT 1;

-- Update cycle_start_date to 31/03/2026 for all offices
UPDATE public.office_settings SET cycle_start_date = '2026-03-31';
