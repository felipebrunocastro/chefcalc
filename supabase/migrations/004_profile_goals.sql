-- ChefCalc — 004: perfil completo do restaurante, metas de vendas e vendas por canal
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Requer a 002. É idempotente: pode rodar mais de uma vez.

alter table public.restaurants    add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.restaurants    add column if not exists goals   jsonb not null default '{}'::jsonb;
alter table public.finance_months add column if not exists sales   jsonb not null default '{}'::jsonb;

-- Contatos privados e observações de consultoria: tabela separada, só o dono acessa
-- (quem recebeu acesso compartilhado lê o perfil público, nunca estes dados).
create table if not exists public.restaurant_private (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.restaurant_private enable row level security;
drop policy if exists "owner private data" on public.restaurant_private;
create policy "owner private data" on public.restaurant_private
  for all using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

-- Quem não é dono (papel 'finance') pode mudar orçamento e metas, nunca nome, moeda, logo ou perfil.
create or replace function public.guard_restaurant_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.user_id is distinct from auth.uid() and (
       new.user_id is distinct from old.user_id or new.name is distinct from old.name
       or new.currency is distinct from old.currency or new.logo is distinct from old.logo
       or new.profile is distinct from old.profile
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
