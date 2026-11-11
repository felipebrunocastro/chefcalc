-- ChefCalc — 008: exclusão de restaurante com lixeira de 90 dias
--
-- Como aplicar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Requer 002 a 007. É idempotente.
--
-- Excluir um restaurante agora só marca deleted_at (exige digitar o nome, conferido no banco).
-- Durante 90 dias tudo fica guardado e o dono pode reativar. Enquanto excluído:
--   • ninguém com acesso compartilhado vê ou opera o restaurante;
--   • o dono vê o restaurante só na lista "Excluídos recentemente" e não altera os dados.
-- Depois de 90 dias, o restaurante e todos os dados dele são apagados definitivamente.
-- O app não consegue mais apagar restaurantes direto da tabela.

alter table public.restaurants add column if not exists deleted_at timestamptz;
alter table public.restaurants add column if not exists deleted_by uuid references auth.users(id) on delete set null;
create index if not exists restaurants_deleted_idx on public.restaurants(deleted_at) where deleted_at is not null;

-- Dono só "possui" (lê/grava fichas, insumos, finanças, caixa...) restaurantes ativos.
create or replace function public.owns_restaurant(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.restaurants where id = rid and user_id = auth.uid() and deleted_at is null); $$;

-- Acessos compartilhados param de valer enquanto o restaurante estiver excluído.
create or replace function public.member_role(rid uuid)
returns text language sql stable security definer set search_path = public
as $$
  select m.role from public.restaurant_members m
  join public.restaurants r on r.id = m.restaurant_id and r.deleted_at is null
  where m.restaurant_id = rid and m.status = 'active'
    and (m.user_id = auth.uid() or (m.user_id is null and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))))
  limit 1;
$$;

create or replace function public.member_unit(rid uuid)
returns text language sql stable security definer set search_path = public
as $$
  select nullif(m.unit, '') from public.restaurant_members m
  join public.restaurants r on r.id = m.restaurant_id and r.deleted_at is null
  where m.restaurant_id = rid and m.status = 'active'
    and (m.user_id = auth.uid() or (m.user_id is null and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))))
  limit 1;
$$;

-- Restaurantes: o dono lê os seus (inclusive excluídos), cria e altera só os ativos. Sem DELETE pelo app.
drop policy if exists "own restaurants" on public.restaurants;
drop policy if exists "own restaurants read" on public.restaurants;
drop policy if exists "own restaurants insert" on public.restaurants;
drop policy if exists "own restaurants update" on public.restaurants;
create policy "own restaurants read" on public.restaurants for select using (auth.uid() = user_id);
create policy "own restaurants insert" on public.restaurants for insert with check (auth.uid() = user_id and deleted_at is null);
create policy "own restaurants update" on public.restaurants for update
  using (auth.uid() = user_id and deleted_at is null) with check (auth.uid() = user_id and deleted_at is null);

-- Apaga de vez o que passou de 90 dias na lixeira (fichas, insumos etc. vão junto por cascade).
create or replace function public.purge_expired_restaurants()
returns int language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  delete from public.restaurants where deleted_at is not null and deleted_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Excluir: só o dono, e só digitando o nome exato do restaurante.
create or replace function public.archive_restaurant(rid uuid, confirm_name text)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  perform public.purge_expired_restaurants();
  select * into r from public.restaurants where id = rid;
  if r is null or r.user_id is distinct from auth.uid() then raise exception 'Somente o dono pode excluir o restaurante' using errcode = '42501'; end if;
  if r.deleted_at is not null then return r.deleted_at; end if;
  if btrim(coalesce(confirm_name, '')) <> btrim(r.name) then
    raise exception 'O nome digitado não confere com o nome do restaurante' using errcode = '22023';
  end if;
  update public.restaurants set deleted_at = now(), deleted_by = auth.uid() where id = rid;
  return now();
end;
$$;

-- Reativar: só o dono, dentro de 90 dias. Devolve false se o prazo acabou
-- (nesse caso o restaurante já foi apagado definitivamente pela limpeza).
drop function if exists public.restore_restaurant(uuid);
create or replace function public.restore_restaurant(rid uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  perform public.purge_expired_restaurants();
  select * into r from public.restaurants where id = rid;
  if r is null then return false; end if;
  if r.user_id is distinct from auth.uid() then raise exception 'Somente o dono pode reativar o restaurante' using errcode = '42501'; end if;
  update public.restaurants set deleted_at = null, deleted_by = null where id = rid;
  return true;
end;
$$;

revoke all on function public.archive_restaurant(uuid, text) from public, anon;
revoke all on function public.restore_restaurant(uuid) from public, anon;
revoke all on function public.purge_expired_restaurants() from public, anon;
grant execute on function public.archive_restaurant(uuid, text) to authenticated;
grant execute on function public.restore_restaurant(uuid) to authenticated;
grant execute on function public.purge_expired_restaurants() to authenticated;

-- Limpeza diária automática, se a extensão pg_cron estiver disponível no projeto.
-- (Sem ela, a limpeza roda sempre que alguém exclui ou reativa um restaurante.)
do $cron$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível: a limpeza roda ao excluir/reativar restaurantes.';
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'chefcalc-purge-restaurants';
    perform cron.schedule('chefcalc-purge-restaurants', '17 4 * * *', 'select public.purge_expired_restaurants()');
  end if;
exception when others then
  raise notice 'Não foi possível agendar a limpeza diária (%). A limpeza roda ao excluir/reativar.', sqlerrm;
end
$cron$;

-- Painel administrativo: negócios excluídos não entram nos totais.
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public, auth
as $$
declare result jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'Acesso restrito ao administrador' using errcode = '42501';
  end if;

  with r as (
    select r.id, r.user_id, r.name, r.created_at, r.deleted_at,
      (select count(*) from public.dishes d where d.restaurant_id = r.id) as dishes,
      (select count(*) from public.ingredients i where i.restaurant_id = r.id) as ingredients,
      (select count(*) from public.restaurant_members m where m.restaurant_id = r.id and m.status = 'active') as members
    from public.restaurants r
  ),
  u as (
    select au.id, au.email, au.created_at, au.last_sign_in_at, au.email_confirmed_at is not null as confirmed,
      coalesce((select jsonb_agg(jsonb_build_object(
          'id', r.id, 'name', r.name, 'createdAt', r.created_at, 'deletedAt', r.deleted_at,
          'dishes', r.dishes, 'ingredients', r.ingredients, 'members', r.members) order by r.created_at)
        from r where r.user_id = au.id), '[]'::jsonb) as restaurants,
      (select count(*) from r where r.user_id = au.id and r.deleted_at is null) as restaurant_count,
      coalesce((select sum(r.dishes) from r where r.user_id = au.id and r.deleted_at is null), 0) as dish_count,
      coalesce((select sum(r.ingredients) from r where r.user_id = au.id and r.deleted_at is null), 0) as ingredient_count,
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
      'restaurants', (select count(*) from r where deleted_at is null),
      'deletedRestaurants', (select count(*) from r where deleted_at is not null),
      'dishes', (select coalesce(sum(dishes), 0) from r where deleted_at is null),
      'ingredients', (select coalesce(sum(ingredients), 0) from r where deleted_at is null)
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
