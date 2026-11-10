-- Teste local da migração 002 (Postgres puro, simula o schema auth do Supabase).
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/migration_test.sql  (num banco vazio)
\set ON_ERROR_STOP 1
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
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
\ir ../migrations/003_sharing.sql
\ir ../migrations/003_sharing.sql
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

-- ---------- 003: compartilhamento ----------
insert into auth.users values ('cccccccc-0000-0000-0000-000000000003'), ('dddddddd-0000-0000-0000-000000000004');
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'a@test.com', false);
do $$
declare ra uuid;
begin
  select id into ra from public.restaurants where name = 'Meu restaurante';
  insert into public.restaurant_members (restaurant_id, email, role) values (ra, 'viewer@test.com', 'viewer'), (ra, 'fin@test.com', 'finance');
  insert into public.finance_months (restaurant_id, period, entries) values (ra, '2026-11', '[]');
end $$;

-- Viewer: vê o restaurante e as fichas, não vê finanças, não grava nada
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claim.email', 'Viewer@Test.com', false);
do $$
declare n int; ra uuid;
begin
  select count(*) into n from public.restaurants; assert n = 1, 'viewer vê só o restaurante compartilhado, veio ' || n;
  select id into ra from public.restaurants;
  select count(*) into n from public.dishes; assert n = 1, 'viewer vê as fichas';
  select count(*) into n from public.ingredients; assert n = 1, 'viewer lê insumos para o custo';
  select count(*) into n from public.finance_months; assert n = 0, 'viewer não vê financeiro';
  update public.dishes set data = '{}' ; get diagnostics n = row_count; assert n = 0, 'viewer não edita ficha';
  delete from public.dishes; get diagnostics n = row_count; assert n = 0, 'viewer não apaga ficha';
  update public.restaurants set budget = '[1]'; get diagnostics n = row_count; assert n = 0, 'viewer não edita orçamento';
  begin
    insert into public.dishes (id, user_id, restaurant_id, data) values ('dish-v', 'cccccccc-0000-0000-0000-000000000003', ra, '{}');
    raise exception 'viewer não deveria criar ficha';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.finance_months (restaurant_id, period) values (ra, '2026-12');
    raise exception 'viewer não deveria gravar financeiro';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.restaurant_members (restaurant_id, email, role) values (ra, 'x@test.com', 'finance');
    raise exception 'viewer não deveria convidar';
  exception when insufficient_privilege then null; end;
end $$;

-- Finance: vê fichas, edita financeiro e orçamento, não muda nome nem fichas
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', false);
select set_config('request.jwt.claim.email', 'fin@test.com', false);
do $$
declare n int; ra uuid;
begin
  select id into ra from public.restaurants; 
  select count(*) into n from public.dishes; assert n = 1, 'finance vê as fichas';
  update public.dishes set data = '{}'; get diagnostics n = row_count; assert n = 0, 'finance não edita ficha';
  update public.finance_months set entries = '[{"valor":5}]' where restaurant_id = ra; get diagnostics n = row_count; assert n = 1, 'finance edita mês existente';
  insert into public.finance_months (restaurant_id, period, user_id) values (ra, '2026-12', 'dddddddd-0000-0000-0000-000000000004');
  update public.restaurants set budget = '[{"valor":1}]', updated_at = now() where id = ra; get diagnostics n = row_count; assert n = 1, 'finance edita orçamento';
  begin
    update public.restaurants set name = 'hack' where id = ra;
    raise exception 'finance não deveria renomear';
  exception when insufficient_privilege then null; end;
end $$;

-- Dono continua vendo os meses gravados pela pessoa de finanças; removendo o acesso, ela perde tudo
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'a@test.com', false);
do $$
declare n int;
begin
  select count(*) into n from public.finance_months where period in ('2026-11', '2026-12'); assert n = 2, 'dono vê meses gravados pelo membro';
  delete from public.restaurant_members where email = 'fin@test.com';
end $$;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', false);
select set_config('request.jwt.claim.email', 'fin@test.com', false);
do $$
declare n int;
begin
  select count(*) into n from public.restaurants; assert n = 0, 'acesso removido';
  select count(*) into n from public.finance_months; assert n = 0, 'acesso removido (financeiro)';
end $$;
reset role;
select 'MIGRATION TESTS PASSED' as result;
