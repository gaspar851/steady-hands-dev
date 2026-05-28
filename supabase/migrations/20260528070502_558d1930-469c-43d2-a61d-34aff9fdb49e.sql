-- Roles enum + table
create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "view own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles insert" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles delete" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  strategy_name text not null default '',
  balance numeric not null default 10000,
  starting_balance numeric not null default 10000,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "view own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins insert profile" on public.profiles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin') or id = auth.uid());
create policy "admins delete profile" on public.profiles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- Trades
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  direction text not null check (direction in ('long','short')),
  status text not null default 'open' check (status in ('open','closed')),
  entry_time timestamptz not null default now(),
  entry_price numeric not null,
  exit_time timestamptz,
  exit_price numeric,
  position_size numeric not null,
  leverage numeric not null default 1,
  stop_loss numeric,
  take_profit numeric,
  fees numeric not null default 0,
  swaps numeric not null default 0,
  risk_pct numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trades enable row level security;

create policy "view own trades" on public.trades for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own trades" on public.trades for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "update own trades" on public.trades for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "delete own trades" on public.trades for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Trade comments
create table public.trade_comments (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid references public.trades(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.trade_comments enable row level security;

create policy "view comments" on public.trade_comments for select to authenticated
  using (
    exists(select 1 from public.trades t where t.id = trade_id and (t.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );
create policy "insert comments" on public.trade_comments for insert to authenticated
  with check (
    author_id = auth.uid() and
    exists(select 1 from public.trades t where t.id = trade_id and (t.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );
create policy "delete own comments" on public.trade_comments for delete to authenticated
  using (author_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Balance events
create table public.balance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('reset','add','remove','adjust','trade')),
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.balance_events enable row level security;

create policy "view own events" on public.balance_events for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert events" on public.balance_events for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- updated_at trigger fn
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trades_touch before update on public.trades
  for each row execute function public.touch_updated_at();

-- Signup handler
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  insert into public.profiles (id, email, full_name, phone, strategy_name)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'strategy_name','My Strategy')
  );
  select not exists(select 1 from public.user_roles) into is_first;
  insert into public.user_roles (user_id, role)
  values (new.id, case when is_first then 'admin'::app_role else 'user'::app_role end);
  insert into public.balance_events (user_id, actor_id, type, amount, note)
  values (new.id, new.id, 'reset', 10000, 'Initial demo balance');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Balance guard
create or replace function public.guard_profile_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.balance is distinct from old.balance
      or new.starting_balance is distinct from old.starting_balance)
     and auth.uid() is not null
     and not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'balance fields are read-only; use server actions';
  end if;
  return new;
end; $$;
revoke execute on function public.guard_profile_balance() from public, anon, authenticated;

create trigger profiles_balance_guard
  before update on public.profiles
  for each row execute function public.guard_profile_balance();

-- Knowledge entries
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

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads active entries" ON public.knowledge_entries FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins insert entries" ON public.knowledge_entries FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins update entries" ON public.knowledge_entries FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins delete entries" ON public.knowledge_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER knowledge_entries_touch_updated_at
BEFORE UPDATE ON public.knowledge_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.knowledge_entries (title, content, category) VALUES
('What is Open Trader?', 'Open Trader is an open-source, community-driven, decentralised demo trading platform. It lets you practice trading with live market data using a simulated balance — no real money is ever at risk.', 'overview'),
('Demo balance', 'Every new account starts with a 10,000 USDT demo balance. An admin can adjust your balance for special scenarios. All balance changes are recorded in your Transactions history.', 'getting-started'),
('Fees', 'Open Trader charges a taker fee of 0.01% per side (0.02% round-trip) on the notional value of a position.', 'fees'),
('Leverage', 'You can open leveraged positions up to the limit configured per market. Higher leverage means larger position size relative to your margin — and larger gains or losses.', 'trading'),
('Is this real money?', 'No. Open Trader is a sandbox. All trades are simulated against live market prices, but no real funds are deposited, traded, or withdrawn.', 'overview'),
('How do I start trading?', 'Sign up with email and password (or Google), then go to the Trade page. Pick a market, enter your position size and leverage, and click Long or Short to open a position.', 'getting-started'),
('Open source', 'Open Trader is fully open-source. The code is transparent and forkable so anyone can audit, contribute, or run their own instance.', 'overview');

-- Explicit GRANTs
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_comments TO authenticated;
GRANT ALL ON public.trade_comments TO service_role;
GRANT SELECT, INSERT ON public.balance_events TO authenticated;
GRANT ALL ON public.balance_events TO service_role;
GRANT SELECT ON public.knowledge_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_entries TO authenticated;
GRANT ALL ON public.knowledge_entries TO service_role;