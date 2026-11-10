-- ChefCalc — 002: modo consultor (vários restaurantes por conta)
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- É idempotente: pode rodar mais de uma vez sem duplicar nem apagar dados.
--
-- O que faz:
--   1. Cria a tabela restaurants (nome, moeda, logo, orçamento mensal de referência).
--   2. Adiciona restaurant_id em ingredients e dishes.
--   3. Cria finance_months (custos reais por mês + snapshot da estimativa usada).
--   4. Migra dados antigos: cada conta com fichas/insumos sem restaurante recebe
--      "Meu restaurante" (ou usa o primeiro restaurante que já tiver) e todos os
--      registros antigos passam a apontar para ele. IDs não mudam, então os vínculos
--      ficha ↔ insumo continuam iguais.
--   5. Troca as políticas RLS: só o dono do restaurante lê/escreve os dados dele.
--   6. Impede (no banco) que uma ficha use insumo de outro restaurante.

create extension if not exists pgcrypto;

-- 1. Restaurantes -----------------------------------------------------------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  currency text not null default 'BRL',
  logo text,                                -- data URL (imagem já redimensionada no app)
  budget jsonb not null default '[]'::jsonb, -- orçamento mensal de referência
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurants_user_idx on public.restaurants(user_id, created_at);

-- 2. Escopo por restaurante -------------------------------------------------
alter table public.ingredients add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade;
alter table public.dishes      add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade;
alter table public.ingredients alter column user_id set default auth.uid();
alter table public.dishes      alter column user_id set default auth.uid();
create index if not exists ingredients_restaurant_idx on public.ingredients(restaurant_id);
create index if not exists dishes_restaurant_idx      on public.dishes(restaurant_id);

-- 3. Financeiro: um registro por restaurante e mês ---------------------------
create table if not exists public.finance_months (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), -- 'YYYY-MM'
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  estimate_snapshot jsonb,                  -- cópia do orçamento usado neste mês
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, period)
);

-- 4. Migração dos dados antigos (idempotente) --------------------------------
insert into public.restaurants (user_id, name)
select u.user_id, 'Meu restaurante'
from (
  select user_id from public.ingredients where restaurant_id is null
  union
  select user_id from public.dishes where restaurant_id is null
) u
where not exists (select 1 from public.restaurants r where r.user_id = u.user_id);

update public.ingredients i
set restaurant_id = (select r.id from public.restaurants r where r.user_id = i.user_id order by r.created_at, r.id limit 1)
where i.restaurant_id is null;

update public.dishes d
set restaurant_id = (select r.id from public.restaurants r where r.user_id = d.user_id order by r.created_at, r.id limit 1)
where d.restaurant_id is null;

alter table public.ingredients alter column restaurant_id set not null;
alter table public.dishes      alter column restaurant_id set not null;

-- 5. RLS --------------------------------------------------------------------
create or replace function public.owns_restaurant(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.restaurants where id = rid and user_id = auth.uid());
$$;

alter table public.restaurants    enable row level security;
alter table public.finance_months enable row level security;
alter table public.ingredients    enable row level security;
alter table public.dishes         enable row level security;

drop policy if exists "own restaurants" on public.restaurants;
create policy "own restaurants" on public.restaurants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own ingredients" on public.ingredients;
drop policy if exists "restaurant ingredients" on public.ingredients;
create policy "restaurant ingredients" on public.ingredients
  for all using (auth.uid() = user_id and public.owns_restaurant(restaurant_id))
  with check (auth.uid() = user_id and public.owns_restaurant(restaurant_id));

drop policy if exists "own dishes" on public.dishes;
drop policy if exists "restaurant dishes" on public.dishes;
create policy "restaurant dishes" on public.dishes
  for all using (auth.uid() = user_id and public.owns_restaurant(restaurant_id))
  with check (auth.uid() = user_id and public.owns_restaurant(restaurant_id));

drop policy if exists "restaurant finance" on public.finance_months;
create policy "restaurant finance" on public.finance_months
  for all using (auth.uid() = user_id and public.owns_restaurant(restaurant_id))
  with check (auth.uid() = user_id and public.owns_restaurant(restaurant_id));

-- 6. Ficha só pode usar insumos do próprio restaurante -----------------------
-- Rejeita IDs de insumo que existem em OUTRO restaurante. IDs que não existem
-- mais (insumo apagado) são tolerados para não travar a edição de fichas antigas.
create or replace function public.check_dish_ingredients()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(coalesce(new.data -> 'itens', '[]'::jsonb)) it
    join public.ingredients i on i.id = it ->> 'ingredienteId'
    where i.restaurant_id <> new.restaurant_id
  ) then
    raise exception 'A ficha técnica usa insumo de outro restaurante' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists dishes_check_ingredients on public.dishes;
create trigger dishes_check_ingredients
  before insert or update on public.dishes
  for each row execute function public.check_dish_ingredients();
