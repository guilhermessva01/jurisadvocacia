
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  description text NOT NULL,
  type text NOT NULL DEFAULT 'feriado',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX holidays_date_key ON public.holidays (date);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage holidays" ON public.holidays
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view holidays" ON public.holidays
  FOR SELECT TO authenticated
  USING (true);
