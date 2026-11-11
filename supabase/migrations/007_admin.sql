-- ChefCalc — 007: painel administrativo do dono do app
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Requer 002 a 006. É idempotente.
--
-- Quem é administrador fica na tabela app_admins. Ninguém consegue se tornar
-- administrador pelo app: só por SQL no painel do Supabase, por exemplo:
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'seu@email.com'
--   on conflict do nothing;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
drop policy if exists "admins read self" on public.app_admins;
create policy "admins read self" on public.app_admins for select using (user_id = auth.uid());
-- Sem políticas de insert/update/delete: o app não altera esta tabela.

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.app_admins where user_id = auth.uid()); $$;

-- Visão geral: totais + cada usuário com seus negócios, fichas técnicas e insumos.
-- Só administradores; qualquer outra conta recebe erro de permissão.
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public, auth
as $$
declare result jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;

  with r as (
    select r.id, r.user_id, r.name, r.created_at,
      (select count(*) from public.dishes d where d.restaurant_id = r.id) as dishes,
      (select count(*) from public.ingredients i where i.restaurant_id = r.id) as ingredients,
      (select count(*) from public.restaurant_members m where m.restaurant_id = r.id and m.status = 'active') as members
    from public.restaurants r
  ),
  u as (
    select au.id, au.email, au.created_at, au.last_sign_in_at, au.email_confirmed_at is not null as confirmed,
      coalesce((select jsonb_agg(jsonb_build_object(
          'id', r.id, 'name', r.name, 'createdAt', r.created_at,
          'dishes', r.dishes, 'ingredients', r.ingredients, 'members', r.members) order by r.created_at)
        from r where r.user_id = au.id), '[]'::jsonb) as restaurants,
      (select count(*) from r where r.user_id = au.id) as restaurant_count,
      coalesce((select sum(r.dishes) from r where r.user_id = au.id), 0) as dish_count,
      coalesce((select sum(r.ingredients) from r where r.user_id = au.id), 0) as ingredient_count,
      (select count(*) from public.restaurant_members m
        where m.status = 'active' and (m.user_id = au.id or (m.user_id is null and m.email = lower(au.email)))) as shared_count,
      exists (select 1 from public.app_admins a where a.user_id = au.id) as is_admin
    from auth.users au
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'totals', jsonb_build_object(
      'users', (select count(*) from u),
      'confirmedUsers', (select count(*) from u where confirmed),
      'newUsers7', (select count(*) from u where created_at > now() - interval '7 days'),
      'newUsers30', (select count(*) from u where created_at > now() - interval '30 days'),
      'active7', (select count(*) from u where last_sign_in_at > now() - interval '7 days'),
      'usersWithRestaurant', (select count(*) from u where restaurant_count > 0),
      'restaurants', (select count(*) from r),
      'dishes', (select coalesce(sum(dishes), 0) from r),
      'ingredients', (select coalesce(sum(ingredients), 0) from r)
    ),
    'users', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'createdAt', created_at, 'lastSignInAt', last_sign_in_at,
        'confirmed', confirmed, 'isAdmin', is_admin,
        'restaurantCount', restaurant_count, 'dishCount', dish_count,
        'ingredientCount', ingredient_count, 'sharedCount', shared_count,
        'restaurants', restaurants) order by created_at desc) from u), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;
