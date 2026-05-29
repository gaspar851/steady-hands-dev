
CREATE TABLE public.wire_transfer_details (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text,
  iban text,
  swift text,
  routing_number text,
  bank_address text,
  reference_instructions text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wire_transfer_details TO authenticated;
GRANT ALL ON public.wire_transfer_details TO service_role;

ALTER TABLE public.wire_transfer_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated view active wire details"
ON public.wire_transfer_details
FOR SELECT TO authenticated
USING (is_active OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert wire details"
ON public.wire_transfer_details
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update wire details"
ON public.wire_transfer_details
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete wire details"
ON public.wire_transfer_details
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER wire_transfer_details_touch_updated_at
BEFORE UPDATE ON public.wire_transfer_details
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_wire_transfer_details_country ON public.wire_transfer_details(country);
