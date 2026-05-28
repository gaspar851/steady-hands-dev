
-- 1. wallet_identities: verified wallet ↔ user links
CREATE TABLE public.wallet_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL CHECK (chain IN ('evm', 'solana')),
  address TEXT NOT NULL,
  address_lower TEXT GENERATED ALWAYS AS (lower(address)) STORED,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wallet_identities_chain_address_unique
  ON public.wallet_identities (chain, address_lower);
CREATE INDEX wallet_identities_user_idx ON public.wallet_identities (user_id);

GRANT SELECT ON public.wallet_identities TO authenticated;
GRANT ALL ON public.wallet_identities TO service_role;

ALTER TABLE public.wallet_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own wallet identities"
  ON public.wallet_identities FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2. wallet_nonces: signing challenges (server-only)
CREATE TABLE public.wallet_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL CHECK (chain IN ('evm', 'solana')),
  address TEXT NOT NULL,
  address_lower TEXT GENERATED ALWAYS AS (lower(address)) STORED,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wallet_nonces_lookup_idx
  ON public.wallet_nonces (chain, address_lower, nonce);
CREATE INDEX wallet_nonces_expires_idx ON public.wallet_nonces (expires_at);

GRANT ALL ON public.wallet_nonces TO service_role;

ALTER TABLE public.wallet_nonces ENABLE ROW LEVEL SECURITY;
-- No policies for end users; service_role bypasses RLS.

-- 3. deposit_addresses: per-user receiving addresses
CREATE TABLE public.deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL CHECK (chain IN ('evm', 'solana')),
  address TEXT NOT NULL,
  address_lower TEXT GENERATED ALWAYS AS (lower(address)) STORED,
  derivation_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX deposit_addresses_chain_address_unique
  ON public.deposit_addresses (chain, address_lower);
CREATE UNIQUE INDEX deposit_addresses_chain_index_unique
  ON public.deposit_addresses (chain, derivation_index);
CREATE UNIQUE INDEX deposit_addresses_user_chain_unique
  ON public.deposit_addresses (user_id, chain);
CREATE INDEX deposit_addresses_user_idx ON public.deposit_addresses (user_id);

GRANT SELECT ON public.deposit_addresses TO authenticated;
GRANT ALL ON public.deposit_addresses TO service_role;

ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own deposit addresses"
  ON public.deposit_addresses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4. deposits: incoming USDT transfers
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL CHECK (chain IN ('evm', 'solana')),
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL DEFAULT 0,
  from_address TEXT,
  to_address TEXT NOT NULL,
  token TEXT NOT NULL,                  -- 'USDT' for now
  token_contract TEXT,                  -- ERC-20 contract or SPL mint
  amount NUMERIC(38, 8) NOT NULL,       -- USDT amount in human units
  confirmations INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','credited','failed')),
  credited_balance_event_id UUID REFERENCES public.balance_events(id) ON DELETE SET NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX deposits_chain_tx_log_unique
  ON public.deposits (chain, tx_hash, log_index);
CREATE INDEX deposits_user_idx ON public.deposits (user_id, created_at DESC);
CREATE INDEX deposits_status_idx ON public.deposits (status);

GRANT SELECT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own deposits"
  ON public.deposits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger reusing existing touch_updated_at()
CREATE TRIGGER deposits_touch_updated_at
  BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Extend balance_events.type allowlist via a CHECK-free design:
--   balance_events already has a free-form `type` text column with no CHECK,
--   so 'deposit' values insert without schema change. No migration needed there.

-- 6. Realtime: publish deposits so the wallet page can stream pending→credited
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
