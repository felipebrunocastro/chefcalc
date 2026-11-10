-- ChefCalc — 006: Caixa e Vendas + convites de equipe (Operador de Caixa e Finanças)
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Requer 002 a 005. É idempotente.
--
-- Papéis em restaurant_members:
--   viewer   → só fichas técnicas (leitura)
--   finance  → fichas (leitura) + Financeiro (edição)
--   operator → Caixa e Vendas (operação), Financeiro (leitura + resumos de vendas pelo Caixa),
--              fichas técnicas (leitura). Pode ser restrito a uma unidade.

-- ---------------------------------------------------------------- Convites
alter table public.restaurant_members drop constraint if exists restaurant_members_role_check;
alter table public.restaurant_members add constraint restaurant_members_role_check check (role in ('viewer', 'finance', 'operator'));
alter table public.restaurant_members add column if not exists status text not null default 'active';
alter table public.restaurant_members drop constraint if exists restaurant_members_status_check;
alter table public.restaurant_members add constraint restaurant_members_status_check check (status in ('pending', 'active'));
alter table public.restaurant_members add column if not exists unit text;            -- null = todas as unidades
alter table public.restaurant_members add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.restaurant_members add column if not exists token_hash text;      -- sha-256 do token do link de convite
alter table public.restaurant_members add column if not exists invited_at timestamptz default now();
alter table public.restaurant_members add column if not exists expires_at timestamptz;
alter table public.restaurant_members add column if not exists accepted_at timestamptz;

-- Papel ATIVO do usuário logado. Depois de aceito, o acesso fica preso à conta (user_id).
create or replace function public.member_role(rid uuid)
returns text language sql stable security definer set search_path = public
as $$
  select role from public.restaurant_members
  where restaurant_id = rid and status = 'active'
    and (user_id = auth.uid() or (user_id is null and email = lower(coalesce(auth.jwt() ->> 'email', ''))))
  limit 1;
$$;

create or replace function public.member_unit(rid uuid)
returns text language sql stable security definer set search_path = public
as $$
  select nullif(unit, '') from public.restaurant_members
  where restaurant_id = rid and status = 'active'
    and (user_id = auth.uid() or (user_id is null and email = lower(coalesce(auth.jwt() ->> 'email', ''))))
  limit 1;
$$;

-- Leitura do Financeiro: dono, 'finance' e 'operator'.
create or replace function public.can_read_finance(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.owns_restaurant(rid) or public.member_role(rid) in ('finance', 'operator'); $$;

-- Importar / acrescentar vendas: dono, 'finance' e 'operator'.
create or replace function public.can_import_sales(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.owns_restaurant(rid) or public.member_role(rid) in ('finance', 'operator'); $$;

-- Operar o caixa de uma unidade: dono ou 'operator' (respeitando a unidade autorizada).
create or replace function public.can_operate(rid uuid, u text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.owns_restaurant(rid)
    or (public.member_role(rid) = 'operator' and (public.member_unit(rid) is null or public.member_unit(rid) = coalesce(u, '')));
$$;

-- Aceitar convite: token do link + e-mail da conta logada iguais ao convite.
create or replace function public.accept_invite(token text)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$
declare m record;
begin
  select * into m from public.restaurant_members
  where token_hash = encode(digest(token, 'sha256'), 'hex') and status = 'pending'
  limit 1;
  if m is null then raise exception 'Convite inválido ou já utilizado' using errcode = '22023'; end if;
  if m.expires_at is not null and m.expires_at < now() then raise exception 'Convite expirado' using errcode = '22023'; end if;
  if m.email <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Este convite foi enviado para outro e-mail' using errcode = '42501';
  end if;
  update public.restaurant_members
    set status = 'active', user_id = auth.uid(), accepted_at = now(), token_hash = null
    where restaurant_id = m.restaurant_id and email = m.email;
  return m.restaurant_id;
end;
$$;

-- Dados do convite para a tela de aceite (sem expor nada além do necessário).
create or replace function public.invite_info(token text)
returns table (restaurant_name text, unit text, role text, email text, expired boolean)
language sql stable security definer set search_path = public, extensions
as $$
  select r.name, m.unit, m.role, m.email, (m.expires_at is not null and m.expires_at < now())
  from public.restaurant_members m join public.restaurants r on r.id = m.restaurant_id
  where m.token_hash = encode(digest(token, 'sha256'), 'hex') and m.status = 'pending';
$$;

-- Financeiro: operador lê, só dono/finance gravam.
drop policy if exists "restaurant finance" on public.finance_months;
drop policy if exists "finance read" on public.finance_months;
drop policy if exists "finance write" on public.finance_months;
drop policy if exists "finance update" on public.finance_months;
drop policy if exists "finance delete" on public.finance_months;
create policy "finance read" on public.finance_months for select using (public.can_read_finance(restaurant_id));
create policy "finance write" on public.finance_months for insert with check (public.can_edit_finance(restaurant_id));
create policy "finance update" on public.finance_months for update using (public.can_edit_finance(restaurant_id)) with check (public.can_edit_finance(restaurant_id));
create policy "finance delete" on public.finance_months for delete using (public.can_edit_finance(restaurant_id));

-- Importações: operador também pode acrescentar relatórios de vendas pelo Caixa.
drop policy if exists "finance imports" on public.import_batches;
create policy "finance imports" on public.import_batches
  for all using (public.can_import_sales(restaurant_id)) with check (public.can_import_sales(restaurant_id));
drop policy if exists "finance sales records" on public.sales_records;
create policy "finance sales records" on public.sales_records
  for all using (public.can_import_sales(restaurant_id)) with check (public.can_import_sales(restaurant_id));
drop policy if exists "read integrations" on public.integrations;
create policy "read integrations" on public.integrations for select using (public.can_read_finance(restaurant_id));

alter table public.sales_records add column if not exists payment_method text;  -- cash | card | online | other

-- ---------------------------------------------------------------- Catálogo do caixa
create table if not exists public.pos_products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  category text not null default '',
  price numeric not null check (price >= 0),
  dish_id text,                              -- ficha técnica de origem (opcional)
  sizes jsonb not null default '[]'::jsonb,  -- [{id, name, price}]
  addons jsonb not null default '[]'::jsonb, -- [{id, name, price}]
  tax_pct numeric,                           -- null = usa o padrão do restaurante
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pos_products_restaurant_idx on public.pos_products(restaurant_id);

-- ---------------------------------------------------------------- Turnos
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  unit text not null default '',
  op_date date not null,                     -- data operacional (fuso do restaurante, na abertura)
  shift text not null default '',
  responsible text not null default '',
  opening_cash numeric not null default 0 check (opening_cash >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by uuid default auth.uid() references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  counted_cash numeric,
  expected_cash numeric,
  difference numeric,
  corrections jsonb not null default '[]'::jsonb  -- [{at, by, reason, field, from, to}]
);
create index if not exists cash_sessions_day_idx on public.cash_sessions(restaurant_id, op_date);
create unique index if not exists cash_sessions_one_open on public.cash_sessions(restaurant_id, unit) where status = 'open';

-- Turno fechado só muda pela função de correção (registra responsável, horário e motivo).
create or replace function public.guard_cash_session()
returns trigger language plpgsql as $$
begin
  if old.status = 'closed' and coalesce(current_setting('chefcalc.correction', true), '') <> 'on' then
    raise exception 'Caixa fechado: use a correção com motivo' using errcode = '42501';
  end if;
  if new.status = 'closed' and old.status = 'open' then
    if new.counted_cash is null then raise exception 'Informe o dinheiro contado' using errcode = '23514'; end if;
    new.expected_cash := public.expected_cash(old.id);   -- calculado no servidor
    new.difference := new.counted_cash - new.expected_cash;
    new.closed_at := now();
    new.closed_by := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists cash_sessions_guard on public.cash_sessions;
create trigger cash_sessions_guard before update on public.cash_sessions for each row execute function public.guard_cash_session();

create or replace function public.correct_closed_session(session_id uuid, new_counted numeric, reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare s record;
begin
  select * into s from public.cash_sessions where id = session_id;
  if s is null or not public.can_operate(s.restaurant_id, s.unit) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if s.status <> 'closed' then raise exception 'O caixa ainda está aberto' using errcode = '22023'; end if;
  if coalesce(btrim(reason), '') = '' then raise exception 'Informe o motivo da correção' using errcode = '23514'; end if;
  perform set_config('chefcalc.correction', 'on', true);
  update public.cash_sessions set
    counted_cash = new_counted,
    difference = new_counted - coalesce(expected_cash, 0),
    corrections = corrections || jsonb_build_array(jsonb_build_object(
      'at', now(), 'by', auth.uid(), 'byEmail', auth.jwt() ->> 'email', 'reason', reason, 'field', 'counted_cash', 'from', s.counted_cash, 'to', new_counted))
  where id = session_id;
  perform set_config('chefcalc.correction', 'off', true);
end;
$$;

-- ---------------------------------------------------------------- Vendas do caixa
create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.cash_sessions(id) on delete restrict,
  unit text not null default '',
  op_date date not null,
  code text not null,                         -- nº legível (pode ser digitado no Square para conciliar)
  client_token uuid not null,                 -- idempotência: evita venda duplicada por toque repetido
  channel text not null default 'counter',
  payment text not null default 'cash',
  items jsonb not null,                       -- [{productId, name, size, addons, qty, unitPrice, lineTotal}] (preços do momento)
  subtotal numeric not null,
  discount numeric not null default 0 check (discount >= 0),
  tax numeric not null default 0 check (tax >= 0),
  total numeric not null check (total >= 0),
  received numeric,
  change numeric,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, client_token)
);
create index if not exists pos_sales_day_idx on public.pos_sales(restaurant_id, op_date);

-- Venda registrada só em turno aberto; cancelamento só muda o status (o registro original fica).
create or replace function public.guard_pos_sale()
returns trigger language plpgsql as $$
declare s record;
begin
  if tg_op = 'INSERT' then
    select * into s from public.cash_sessions where id = new.session_id;
    if s is null or s.status <> 'open' or s.restaurant_id <> new.restaurant_id then
      raise exception 'O caixa deste turno não está aberto' using errcode = '23514';
    end if;
    new.unit := s.unit; new.op_date := s.op_date; new.created_by := auth.uid(); new.created_at := now();
    return new;
  end if;
  if new.items is distinct from old.items or new.total is distinct from old.total or new.subtotal is distinct from old.subtotal
     or new.discount is distinct from old.discount or new.tax is distinct from old.tax or new.session_id is distinct from old.session_id
     or new.op_date is distinct from old.op_date or (old.status = 'cancelled') then
    raise exception 'Vendas registradas não podem ser alteradas; use cancelamento ou reembolso' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists pos_sales_guard on public.pos_sales;
create trigger pos_sales_guard before insert or update on public.pos_sales for each row execute function public.guard_pos_sale();

-- Cancelamentos e reembolsos (com motivo, data e responsável). O registro original é mantido.
create table if not exists public.pos_sale_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  session_id uuid references public.cash_sessions(id) on delete set null,  -- turno em que o dinheiro saiu
  kind text not null check (kind in ('cancel', 'refund')),
  amount numeric not null default 0 check (amount >= 0),
  cash boolean not null default true,
  reason text not null check (length(btrim(reason)) > 0),
  responsible text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Suprimentos, sangrias e reembolsos avulsos em dinheiro.
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.cash_sessions(id) on delete restrict,
  kind text not null check (kind in ('supply', 'withdrawal', 'refund')),
  amount numeric not null check (amount > 0),
  reason text not null check (length(btrim(reason)) > 0),
  responsible text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.guard_cash_movement()
returns trigger language plpgsql as $$
declare s record;
begin
  select * into s from public.cash_sessions where id = new.session_id;
  if s is null or s.status <> 'open' or s.restaurant_id <> new.restaurant_id then
    raise exception 'Movimentos só em turno aberto' using errcode = '23514';
  end if;
  new.created_by := auth.uid(); new.created_at := now();
  return new;
end;
$$;
drop trigger if exists cash_movements_guard on public.cash_movements;
create trigger cash_movements_guard before insert on public.cash_movements for each row execute function public.guard_cash_movement();
-- Cancelamento: só com o turno da venda aberto (depois, use reembolso). Reembolso: até o valor restante;
-- reembolso em dinheiro sai de um turno aberto.
create or replace function public.guard_sale_event()
returns trigger language plpgsql as $$
declare v record; s record; refunded numeric;
begin
  select * into v from public.pos_sales where id = new.sale_id;
  if v is null or v.restaurant_id <> new.restaurant_id then raise exception 'Venda não encontrada' using errcode = '23514'; end if;
  if v.status = 'cancelled' then raise exception 'Venda já cancelada' using errcode = '23514'; end if;
  if new.kind = 'cancel' then
    select * into s from public.cash_sessions where id = v.session_id;
    if s.status <> 'open' then raise exception 'Turno da venda já fechado: registre um reembolso' using errcode = '23514'; end if;
    new.amount := v.total; new.session_id := v.session_id;
    update public.pos_sales set status = 'cancelled' where id = v.id;
  else
    select coalesce(sum(amount), 0) into refunded from public.pos_sale_events where sale_id = v.id and kind = 'refund';
    if new.amount <= 0 or new.amount > v.total - refunded + 0.001 then raise exception 'Valor de reembolso inválido' using errcode = '23514'; end if;
    if new.cash then
      select * into s from public.cash_sessions where id = new.session_id;
      if s is null or s.status <> 'open' or s.restaurant_id <> new.restaurant_id then
        raise exception 'Reembolso em dinheiro só com um turno aberto' using errcode = '23514';
      end if;
    end if;
  end if;
  new.created_by := auth.uid(); new.created_at := now();
  return new;
end;
$$;
drop trigger if exists pos_sale_events_guard on public.pos_sale_events;
create trigger pos_sale_events_guard before insert on public.pos_sale_events for each row execute function public.guard_sale_event();

-- ---------------------------------------------------------------- Resumos diários por plataforma
create table if not exists public.channel_summaries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  unit text not null default '',
  op_date date not null,                     -- data da venda
  channel text not null,                     -- square | doordash | ubereats | grubhub | other | __day__ (zero vendas confirmado)
  source_name text,                          -- nome da plataforma (para "other")
  includes jsonb not null default '{}'::jsonb, -- só para totais agregados (ex.: Square): {channels:[], payments:[]}
  gross_sales numeric not null default 0,
  orders int,
  discounts numeric not null default 0,
  refunds numeric not null default 0,
  fees numeric not null default 0,
  payout numeric,
  payout_date date,                          -- data do repasse (conciliação financeira)
  status text not null default 'active' check (status in ('active', 'replaced', 'kept')),
  overlap_resolution text check (overlap_resolution in ('deduct', 'separate')),
  history jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);
create index if not exists channel_summaries_day_idx on public.channel_summaries(restaurant_id, op_date);

-- ---------------------------------------------------------------- RLS
alter table public.pos_products      enable row level security;
alter table public.cash_sessions     enable row level security;
alter table public.pos_sales         enable row level security;
alter table public.pos_sale_events   enable row level security;
alter table public.cash_movements    enable row level security;
alter table public.channel_summaries enable row level security;

drop policy if exists "pos products read" on public.pos_products;
create policy "pos products read" on public.pos_products for select using (public.can_view_restaurant(restaurant_id));
drop policy if exists "pos products owner" on public.pos_products;
create policy "pos products owner" on public.pos_products for all using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

-- Leitura: quem lê o Financeiro. Escrita: quem opera o caixa daquela unidade.
drop policy if exists "cash sessions read" on public.cash_sessions;
create policy "cash sessions read" on public.cash_sessions for select using (public.can_read_finance(restaurant_id));
drop policy if exists "cash sessions insert" on public.cash_sessions;
create policy "cash sessions insert" on public.cash_sessions for insert with check (public.can_operate(restaurant_id, unit));
drop policy if exists "cash sessions update" on public.cash_sessions;
create policy "cash sessions update" on public.cash_sessions for update using (public.can_operate(restaurant_id, unit)) with check (public.can_operate(restaurant_id, unit));

drop policy if exists "pos sales read" on public.pos_sales;
create policy "pos sales read" on public.pos_sales for select using (public.can_read_finance(restaurant_id));
drop policy if exists "pos sales insert" on public.pos_sales;
create policy "pos sales insert" on public.pos_sales for insert with check (public.can_operate(restaurant_id, unit));
drop policy if exists "pos sales update" on public.pos_sales;
create policy "pos sales update" on public.pos_sales for update using (public.can_operate(restaurant_id, unit)) with check (public.can_operate(restaurant_id, unit));

drop policy if exists "pos events read" on public.pos_sale_events;
create policy "pos events read" on public.pos_sale_events for select using (public.can_read_finance(restaurant_id));
drop policy if exists "pos events insert" on public.pos_sale_events;
create policy "pos events insert" on public.pos_sale_events for insert
  with check (public.can_operate(restaurant_id, (select s.unit from public.pos_sales s where s.id = sale_id)));

drop policy if exists "cash movements read" on public.cash_movements;
create policy "cash movements read" on public.cash_movements for select using (public.can_read_finance(restaurant_id));
drop policy if exists "cash movements insert" on public.cash_movements;
create policy "cash movements insert" on public.cash_movements for insert
  with check (public.can_operate(restaurant_id, (select s.unit from public.cash_sessions s where s.id = session_id)));

drop policy if exists "summaries read" on public.channel_summaries;
create policy "summaries read" on public.channel_summaries for select using (public.can_read_finance(restaurant_id));
drop policy if exists "summaries insert" on public.channel_summaries;
create policy "summaries insert" on public.channel_summaries for insert with check (public.can_operate(restaurant_id, unit));
drop policy if exists "summaries update" on public.channel_summaries;
create policy "summaries update" on public.channel_summaries for update using (public.can_operate(restaurant_id, unit)) with check (public.can_operate(restaurant_id, unit));

-- Dinheiro esperado = saldo inicial + vendas em dinheiro + suprimentos − sangrias − reembolsos em dinheiro.
create or replace function public.expected_cash(sid uuid)
returns numeric language sql stable security definer set search_path = public
as $$
  select s.opening_cash
    + coalesce((select sum(total) from public.pos_sales where session_id = sid and status = 'completed' and payment = 'cash'), 0)
    + coalesce((select sum(amount) from public.cash_movements where session_id = sid and kind = 'supply'), 0)
    - coalesce((select sum(amount) from public.cash_movements where session_id = sid and kind in ('withdrawal', 'refund')), 0)
    - coalesce((select sum(amount) from public.pos_sale_events where session_id = sid and kind = 'refund' and cash), 0)
  from public.cash_sessions s where s.id = sid;
$$;
