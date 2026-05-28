
-- =========================================================
-- platform_wallets: admin-managed receive addresses
-- =========================================================
CREATE TABLE public.platform_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin text NOT NULL,
  network text NOT NULL,
  address text NOT NULL,
  memo text,
  qr_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX platform_wallets_unique_active
  ON public.platform_wallets (coin, network)
  WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_wallets TO authenticated;
GRANT ALL ON public.platform_wallets TO service_role;

ALTER TABLE public.platform_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated view active wallets"
  ON public.platform_wallets FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert wallets"
  ON public.platform_wallets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update wallets"
  ON public.platform_wallets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete wallets"
  ON public.platform_wallets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER platform_wallets_touch
  BEFORE UPDATE ON public.platform_wallets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- deposit_requests: user-submitted proofs
-- =========================================================
CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform_wallet_id uuid NOT NULL REFERENCES public.platform_wallets(id) ON DELETE RESTRICT,
  coin text NOT NULL,
  network text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  tx_hash text NOT NULL,
  from_address text,
  proof_image_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id uuid,
  reviewer_note text,
  credited_balance_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX deposit_requests_user_idx ON public.deposit_requests (user_id, created_at DESC);
CREATE INDEX deposit_requests_status_idx ON public.deposit_requests (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own requests"
  ON public.deposit_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users insert own requests"
  ON public.deposit_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND reviewer_id IS NULL
    AND credited_balance_event_id IS NULL
  );

CREATE POLICY "admins update requests"
  ON public.deposit_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- Trigger: on approval, credit balance and link event
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evt_id uuid;
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can approve deposits';
    END IF;

    NEW.reviewer_id := auth.uid();
    NEW.reviewed_at := now();

    INSERT INTO public.balance_events (user_id, actor_id, type, amount, note)
    VALUES (
      NEW.user_id,
      auth.uid(),
      'deposit',
      NEW.amount,
      'Deposit ' || NEW.coin || '/' || NEW.network || ' tx ' || NEW.tx_hash
    )
    RETURNING id INTO evt_id;

    NEW.credited_balance_event_id := evt_id;

    UPDATE public.profiles
    SET balance = balance + NEW.amount
    WHERE id = NEW.user_id;

  ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can reject deposits';
    END IF;
    NEW.reviewer_id := auth.uid();
    NEW.reviewed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER deposit_requests_on_review
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_deposit_approval();

-- =========================================================
-- Storage bucket for proof images
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('deposit-proofs', 'deposit-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users upload own proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deposit-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users view own proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'deposit-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "users delete own proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'deposit-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
