CREATE TABLE public.knowledge_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_entries TO authenticated;
GRANT ALL ON public.knowledge_entries TO service_role;

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads active entries"
ON public.knowledge_entries FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert entries"
ON public.knowledge_entries FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update entries"
ON public.knowledge_entries FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete entries"
ON public.knowledge_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER knowledge_entries_touch_updated_at
BEFORE UPDATE ON public.knowledge_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.knowledge_entries (title, content, category) VALUES
('What is Open Trader?', 'Open Trader is an open-source, community-driven, decentralised demo trading platform. It lets you practice trading with live market data using a simulated balance — no real money is ever at risk.', 'overview'),
('Demo balance', 'Every new account starts with a 10,000 USDT demo balance. An admin can adjust your balance for special scenarios. All balance changes are recorded in your Transactions history.', 'getting-started'),
('Fees', 'Open Trader charges a taker fee of 0.01% per side (0.02% round-trip) on the notional value of a position. For example, a 1,000 USDT position at 10x leverage incurs roughly $2 in round-trip fees.', 'fees'),
('Leverage', 'You can open leveraged positions up to the limit configured per market. Higher leverage means larger position size relative to your margin — and larger gains or losses.', 'trading'),
('Is this real money?', 'No. Open Trader is a sandbox. All trades are simulated against live market prices, but no real funds are deposited, traded, or withdrawn.', 'overview'),
('How do I start trading?', 'Sign up with email and password (or Google), then go to the Trade page. Pick a market, enter your position size and leverage, and click Long or Short to open a position.', 'getting-started'),
('Open source', 'Open Trader is fully open-source. The code is transparent and forkable so anyone can audit, contribute, or run their own instance.', 'overview');