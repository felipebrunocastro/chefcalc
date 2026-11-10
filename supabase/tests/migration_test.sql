-- Teste local da migração 002 (Postgres puro, simula o schema auth do Supabase).
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/migration_test.sql  (num banco vazio)
\set ON_ERROR_STOP 1
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated;

\ir ../schema.sql

-- Dados legados (antes da migração): conta A com 1 insumo e 1 ficha, conta B com 1 insumo.
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.ingredients (id, user_id, data) values
  ('ing-a1', 'aaaaaaaa-0000-0000-0000-000000000001', '{"id":"ing-a1","precoCompra":10}'),
  ('ing-b1', 'bbbbbbbb-0000-0000-0000-000000000002', '{"id":"ing-b1","precoCompra":5}');
insert into public.dishes (id, user_id, data) values
  ('dish-a1', 'aaaaaaaa-0000-0000-0000-000000000001', '{"id":"dish-a1","itens":[{"ingredienteId":"ing-a1","quantidadeUsada":1,"unidade":"kg"}]}');

\ir ../migrations/002_restaurants.sql
\ir ../migrations/002_restaurants.sql
grant select, insert, update, delete on all tables in schema public to authenticated;

do $$
declare n int; ra uuid; ra2 uuid;
begin
  select count(*) into n from public.restaurants;
  assert n = 2, 'idempotente: esperado 2 restaurantes, veio ' || n;
  select count(*) into n from public.restaurants where name = 'Meu restaurante';
  assert n = 2, 'cada conta recebe Meu restaurante';
  select count(*) into n from public.ingredients where restaurant_id is null;
  assert n = 0, 'nenhum insumo sem restaurante';
  select r.id into ra from public.restaurants r where r.user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert (select restaurant_id from public.dishes where id = 'dish-a1') = ra, 'ficha antiga ligada ao restaurante do dono';
  assert (select restaurant_id from public.ingredients where id = 'ing-a1') = ra, 'insumo antigo ligado ao mesmo restaurante';
end $$;

-- RLS como conta A
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare n int; r2 uuid; ra uuid;
begin
  select count(*) into n from public.restaurants; assert n = 1, 'A vê só o próprio restaurante';
  select count(*) into n from public.ingredients; assert n = 1, 'A vê só os próprios insumos';
  select id into ra from public.restaurants;
  insert into public.restaurants (name, currency) values ('Restaurante 2', 'USD') returning id into r2;
  -- mesmo insumo, preço diferente, em outro restaurante
  insert into public.ingredients (id, restaurant_id, data) values ('ing-a2', r2, '{"id":"ing-a2","precoCompra":12}');
  -- ficha do restaurante 1 usando insumo do restaurante 2 deve falhar
  begin
    insert into public.dishes (id, restaurant_id, data) values ('dish-bad', ra, '{"itens":[{"ingredienteId":"ing-a2"}]}');
    raise exception 'deveria ter bloqueado insumo de outro restaurante';
  exception when check_violation then null; end;
  -- finanças
  insert into public.finance_months (restaurant_id, period, entries) values (r2, '2026-10', '[{"valor":10}]');
  -- ficha antiga continua editável
  update public.dishes set data = data || '{"categoria":"x"}' where id = 'dish-a1';
  get diagnostics n = row_count; assert n = 1, 'ficha antiga editável';
end $$;

-- RLS como conta B: não vê nada de A e não consegue gravar no restaurante de A
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
declare n int; foreign_r uuid;
begin
  select count(*) into n from public.restaurants; assert n = 1, 'B vê só o próprio restaurante';
  select count(*) into n from public.dishes; assert n = 0, 'B não vê fichas de A';
  select count(*) into n from public.finance_months; assert n = 0, 'B não vê finanças de A';
  reset role;
  select id into foreign_r from public.restaurants where name = 'Restaurante 2';
  set role authenticated;
  begin
    insert into public.ingredients (id, restaurant_id, data) values ('ing-hack', foreign_r, '{}');
    raise exception 'B não deveria gravar no restaurante de A';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'MIGRATION TESTS PASSED' as result;
