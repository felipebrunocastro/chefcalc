-- ChefCalc — 005: integrações (Square OAuth) e importações de vendas (CSV de delivery e genérico)
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Requer 002, 003 e 004. É idempotente.
--
-- Separação dos dados:
--   restaurants.budget        → orçamento (estimativa)
--   finance_months.entries    → custos manuais
--   sales_records / batches   → dados importados (origem + data de cada registro)

-- Lote de importação (um arquivo CSV ou uma sincronização).
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source text not null,                    -- 'square' | 'doordash' | 'ubereats' | 'grubhub' | 'generic:<nome>'
  channel text not null,                   -- canal de venda no ChefCalc
  unit text not null default '',           -- unidade / loja
  file_name text,
  file_hash text,                          -- SHA-256 do arquivo (reconhece reimportação)
  period_start date,
  period_end date,
  row_count int not null default 0,
  inserted int not null default 0,
  updated int not null default 0,
  summary jsonb not null default '{}'::jsonb,
  mapping jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists import_batches_file_uq on public.import_batches(restaurant_id, source, file_hash) where file_hash is not null;
create index if not exists import_batches_restaurant_idx on public.import_batches(restaurant_id, created_at desc);

-- Registros normalizados. A chave (restaurant_id, source, record_key) evita duplicar valores
-- quando o mesmo arquivo é reimportado ou quando períodos sincronizados se sobrepõem.
create table if not exists public.sales_records (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source text not null,
  record_key text not null,
  channel text not null,
  unit text not null default '',
  kind text not null default 'order' check (kind in ('order', 'refund', 'adjustment', 'payout')),
  external_order_id text,
  external_ref text,                       -- referência externa (ex.: nº do pedido da plataforma registrado no Square)
  source_name text,                        -- origem informada pelo PDV (ex.: 'DoorDash' no Square)
  sale_date date,
  payout_date date,
  net_sales numeric not null default 0,    -- vendas após descontos e devoluções
  commissions numeric not null default 0,
  promotions numeric not null default 0,   -- promoções custeadas pelo restaurante
  other_fees numeric not null default 0,
  taxes numeric not null default 0,
  tips numeric not null default 0,
  adjustments numeric not null default 0,
  payout numeric,                          -- repasse informado pela plataforma
  currency text,
  match_status text not null default 'none' check (match_status in ('none', 'matched', 'review', 'distinct')),
  matched_source text,
  matched_key text,
  batch_id uuid references public.import_batches(id) on delete set null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw jsonb,
  primary key (restaurant_id, source, record_key)
);
create index if not exists sales_records_sale_idx on public.sales_records(restaurant_id, sale_date);
create index if not exists sales_records_payout_idx on public.sales_records(restaurant_id, payout_date);
create index if not exists sales_records_order_idx on public.sales_records(restaurant_id, external_order_id);

-- Conexões (Square etc.). Tokens NÃO ficam aqui: ficam em integration_secrets,
-- acessível somente pelas Edge Functions (service role).
create table if not exists public.integrations (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  merchant_id text,
  locations jsonb not null default '[]'::jsonb,   -- unidades (ex.: locations do Square)
  scopes text[],
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  settings jsonb not null default '{}'::jsonb,
  primary key (restaurant_id, provider)
);

create table if not exists public.integration_secrets (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, provider)
);

alter table public.import_batches      enable row level security;
alter table public.sales_records       enable row level security;
alter table public.integrations        enable row level security;
alter table public.integration_secrets enable row level security; -- sem políticas: só service role

-- Dono e papel 'finance' leem e gravam importações; 'viewer' não vê.
drop policy if exists "finance imports" on public.import_batches;
create policy "finance imports" on public.import_batches
  for all using (public.can_edit_finance(restaurant_id)) with check (public.can_edit_finance(restaurant_id));

drop policy if exists "finance sales records" on public.sales_records;
create policy "finance sales records" on public.sales_records
  for all using (public.can_edit_finance(restaurant_id)) with check (public.can_edit_finance(restaurant_id));

-- Conexões: leitura para dono e 'finance'; conectar/desconectar é feito pelas Edge Functions.
drop policy if exists "read integrations" on public.integrations;
create policy "read integrations" on public.integrations
  for select using (public.can_edit_finance(restaurant_id));
