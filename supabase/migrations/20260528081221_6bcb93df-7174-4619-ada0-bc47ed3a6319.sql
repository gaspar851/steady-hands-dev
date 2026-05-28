
-- 1. Restrict balance_events inserts to admins only (users were able to credit themselves)
DROP POLICY IF EXISTS "insert events" ON public.balance_events;
CREATE POLICY "admins insert events"
  ON public.balance_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Drop legacy/unused tables from the abandoned HD-wallet flow.
DROP TABLE IF EXISTS public.wallet_nonces CASCADE;
DROP TABLE IF EXISTS public.wallet_identities CASCADE;
DROP TABLE IF EXISTS public.deposit_addresses CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;

-- 3. Lock down trigger / definer functions so signed-in users cannot call them via RPC.
REVOKE ALL ON FUNCTION public.handle_deposit_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_balance()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at()       FROM PUBLIC, anon, authenticated;

-- 4. Add explicit UPDATE policy on deposit-proofs bucket: only the uploading user (admins always pass via has_role check elsewhere).
DROP POLICY IF EXISTS "deposit_proofs_update_own" ON storage.objects;
CREATE POLICY "deposit_proofs_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
