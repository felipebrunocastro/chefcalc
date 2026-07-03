-- ChefCalc — schema Supabase
-- Rode este SQL no painel do Supabase: SQL Editor → New query → Run

-- Insumos (um registro por conta, dados em JSONB)
create table if not exists public.ingredients (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Pratos
create table if not exists public.dishes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Assinaturas (preenchida pelo webhook do Stripe)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists ingredients_user_idx on public.ingredients(user_id);
create index if not exists dishes_user_idx on public.dishes(user_id);

-- Row Level Security: cada usuário só enxerga os próprios dados
alter table public.ingredients enable row level security;
alter table public.dishes enable row level security;
alter table public.subscriptions enable row level security;

create policy "own ingredients" on public.ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own dishes" on public.dishes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Assinatura: usuário pode LER a sua; escrita só pelo service role (webhook)
create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
