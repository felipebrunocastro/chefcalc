-- ChefCalc — 003: compartilhamento de restaurante com outra pessoa (por e-mail)
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Requer a 002. É idempotente: pode rodar mais de uma vez.
--
-- Papéis:
--   viewer  → só visualiza as fichas técnicas (sem editar nada).
--   finance → visualiza as fichas técnicas e edita o Financeiro
--             (orçamento de referência e custos reais do mês).
-- O dono continua sendo o único que edita fichas, insumos e dados do restaurante.

create table if not exists public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  role text not null check (role in ('viewer', 'finance')),
  invited_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, email)
);
create index if not exists restaurant_members_email_idx on public.restaurant_members(email);

-- Papel do usuário logado em um restaurante compartilhado (null = sem acesso).
create or replace function public.member_role(rid uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.restaurant_members
  where restaurant_id = rid and email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function public.can_view_restaurant(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.owns_restaurant(rid) or public.member_role(rid) is not null; $$;

create or replace function public.can_edit_finance(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.owns_restaurant(rid) or public.member_role(rid) = 'finance'; $$;

alter table public.restaurant_members enable row level security;

-- Dono gerencia os acessos; a pessoa convidada enxerga só os próprios convites.
drop policy if exists "owner manages members" on public.restaurant_members;
create policy "owner manages members" on public.restaurant_members
  for all using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

drop policy if exists "invitee reads own membership" on public.restaurant_members;
create policy "invitee reads own membership" on public.restaurant_members
  for select using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Leitura para quem recebeu acesso (somente SELECT: não podem gravar fichas/insumos).
drop policy if exists "members read restaurant" on public.restaurants;
create policy "members read restaurant" on public.restaurants
  for select using (public.member_role(id) is not null);

drop policy if exists "members read dishes" on public.dishes;
create policy "members read dishes" on public.dishes
  for select using (public.member_role(restaurant_id) is not null);

-- Insumos são lidos só para calcular o custo exibido nas fichas.
drop policy if exists "members read ingredients" on public.ingredients;
create policy "members read ingredients" on public.ingredients
  for select using (public.member_role(restaurant_id) is not null);

-- Financeiro: dono ou papel 'finance' lê e grava; 'viewer' não vê.
drop policy if exists "restaurant finance" on public.finance_months;
create policy "restaurant finance" on public.finance_months
  for all using (public.can_edit_finance(restaurant_id)) with check (public.can_edit_finance(restaurant_id));

-- Papel 'finance' pode atualizar o orçamento de referência (coluna budget) do restaurante.
drop policy if exists "finance members update budget" on public.restaurants;
create policy "finance members update budget" on public.restaurants
  for update using (public.member_role(id) = 'finance') with check (public.member_role(id) = 'finance');

-- ...mas nunca nome, moeda, logo ou dono.
create or replace function public.guard_restaurant_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.user_id is distinct from auth.uid() and (
       new.user_id is distinct from old.user_id or new.name is distinct from old.name
       or new.currency is distinct from old.currency or new.logo is distinct from old.logo
     ) then
    raise exception 'Somente o dono pode alterar os dados do restaurante' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_guard_update on public.restaurants;
create trigger restaurants_guard_update
  before update on public.restaurants
  for each row execute function public.guard_restaurant_update();
