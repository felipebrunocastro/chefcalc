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
do $$ begin create role anon; exception when duplicate_object then null; end $$;
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
\ir ../migrations/004_profile_goals.sql
\ir ../migrations/004_profile_goals.sql
\ir ../migrations/005_integrations.sql
\ir ../migrations/005_integrations.sql
create schema if not exists extensions;
\ir ../migrations/006_cash_register.sql
\ir ../migrations/006_cash_register.sql
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
  insert into public.restaurant_private (restaurant_id, data) values (ra, '{"consultingNotes":"segredo"}');
  insert into public.sales_records (restaurant_id, source, record_key, channel, net_sales) values (ra, 'doordash', 'order:1', 'doordash', 20);
  insert into public.sales_records (restaurant_id, source, record_key, channel, net_sales) values (ra, 'doordash', 'order:1', 'doordash', 25)
    on conflict (restaurant_id, source, record_key) do update set net_sales = excluded.net_sales;
  assert (select count(*) from public.sales_records) = 1, 'reimportação não duplica';
  assert (select net_sales from public.sales_records) = 25, 'reimportação atualiza';
  update public.restaurants set profile = '{"city":"Miami"}' where id = ra;
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
  select count(*) into n from public.restaurant_private; assert n = 0, 'viewer não lê dados privados';
  select count(*) into n from public.sales_records; assert n = 0, 'viewer não vê importações';
  select count(*) into n from public.restaurants where profile->>'city' = 'Miami'; assert n = 1, 'viewer lê perfil público';
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
  update public.restaurants set goals = '{"scenarios":[5,8,10]}' where id = ra; get diagnostics n = row_count; assert n = 1, 'finance edita metas';
  begin
    update public.restaurants set profile = '{"city":"x"}' where id = ra;
    raise exception 'finance não deveria editar o perfil';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.restaurant_private; assert n = 0, 'finance não lê dados privados';
  select count(*) into n from public.sales_records; assert n = 1, 'finance vê importações';
  insert into public.sales_records (restaurant_id, source, record_key, channel) values (ra, 'ubereats', 'order:9', 'ubereats');
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
insert into public.integration_secrets (restaurant_id, provider, access_token)
  select id, 'square', 'tok' from public.restaurants where name = 'Restaurante 2';
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'a@test.com', false);
do $$
declare n int;
begin
  select count(*) into n from public.integration_secrets; assert n = 0, 'tokens nunca legíveis pelo app';
  select count(*) into n from public.sales_records; assert n = 2, 'dono vê importações do próprio restaurante';
end $$;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claim.email', 'b@test.com', false);
do $$
declare n int;
begin
  select count(*) into n from public.sales_records; assert n = 0, 'outra conta não vê importações';
end $$;
reset role;

-- ---------- 006: Caixa e Vendas + convite de operador ----------
insert into auth.users values ('eeeeeeee-0000-0000-0000-000000000005');
grant select, insert, update, delete on all tables in schema public to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'a@test.com', false);
do $$
declare ra uuid;
begin
  select id into ra from public.restaurants where name = 'Meu restaurante';
  insert into public.restaurant_members (restaurant_id, email, role, status, unit, token_hash, expires_at)
    values (ra, 'op@test.com', 'operator', 'pending', 'Centro', encode(digest('tok123', 'sha256'), 'hex'), now() + interval '7 days');
  insert into public.pos_products (restaurant_id, name, category, price) values (ra, 'Burger', 'Lanches', 12);
end $$;

-- Operador antes de aceitar: não vê nada; conta com outro e-mail não aceita
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-000000000005', false);
select set_config('request.jwt.claim.email', 'op@test.com', false);
do $$
declare n int; rid uuid;
begin
  select count(*) into n from public.restaurants; assert n = 0, 'convite pendente não dá acesso';
  select count(*) into n from public.invite_info('tok123'); assert n = 1, 'tela de aceite lê o convite';
  perform set_config('request.jwt.claim.email', 'outro@test.com', false);
  begin
    perform public.accept_invite('tok123');
    raise exception 'aceitou com e-mail errado';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.email', 'op@test.com', false);
  rid := public.accept_invite('tok123');
  assert rid is not null, 'convite aceito';
  begin
    perform public.accept_invite('tok123');
    raise exception 'token reutilizado';
  exception when invalid_parameter_value then null; end;
end $$;

-- Operador ativo
do $$
declare n int; ra uuid; r2 uuid; sid uuid; sale uuid; s record;
begin
  select id into ra from public.restaurants where name = 'Meu restaurante';
  select count(*) into n from public.restaurants; assert n = 1, 'operador vê só o restaurante autorizado';
  select count(*) into n from public.dishes; assert n = 1, 'operador lê fichas';
  update public.dishes set data = '{}'; get diagnostics n = row_count; assert n = 0, 'operador não edita fichas';
  select count(*) into n from public.finance_months; assert n >= 1, 'operador lê o Financeiro';
  update public.finance_months set entries = '[]'; get diagnostics n = row_count; assert n = 0, 'operador não edita custos';
  update public.restaurants set budget = '[]'; get diagnostics n = row_count; assert n = 0, 'operador não edita orçamento';
  begin
    insert into public.pos_products (restaurant_id, name, price) values (ra, 'Hack', 1);
    raise exception 'operador não deveria editar o catálogo';
  exception when insufficient_privilege then null; end;
  update public.pos_products set price = 1; get diagnostics n = row_count; assert n = 0, 'operador não muda preços';
  -- unidade autorizada
  begin
    insert into public.cash_sessions (restaurant_id, unit, op_date, opening_cash) values (ra, 'Outra', '2026-11-10', 0);
    raise exception 'operador abriu caixa em unidade não autorizada';
  exception when insufficient_privilege then null; end;
  insert into public.cash_sessions (restaurant_id, unit, op_date, shift, responsible, opening_cash)
    values (ra, 'Centro', '2026-11-10', 'Noite', 'Ana', 50) returning id into sid;
  begin
    insert into public.cash_sessions (restaurant_id, unit, op_date, opening_cash) values (ra, 'Centro', '2026-11-10', 0);
    raise exception 'dois turnos abertos na mesma unidade';
  exception when unique_violation then null; end;
  insert into public.pos_sales (restaurant_id, session_id, op_date, code, client_token, items, subtotal, total, received, change)
    values (ra, sid, '2000-01-01', 'CX-1', '11111111-1111-1111-1111-111111111111', '[{"name":"Burger","qty":15,"unitPrice":12}]', 180, 180, 200, 20) returning id into sale;
  select op_date into s from public.pos_sales where id = sale;
  assert s.op_date = '2026-11-10', 'venda herda a data operacional do turno';
  begin
    insert into public.pos_sales (restaurant_id, session_id, op_date, code, client_token, items, subtotal, total)
      values (ra, sid, '2026-11-10', 'CX-2', '11111111-1111-1111-1111-111111111111', '[]', 180, 180);
    raise exception 'toque repetido duplicou a venda';
  exception when unique_violation then null; end;
  begin
    update public.pos_sales set total = 1 where id = sale;
    raise exception 'venda alterada';
  exception when insufficient_privilege then null; end;
  insert into public.cash_movements (restaurant_id, session_id, kind, amount, reason) values (ra, sid, 'withdrawal', 30, 'Depósito no banco');
  insert into public.cash_movements (restaurant_id, session_id, kind, amount, reason) values (ra, sid, 'refund', 10, 'Cliente devolveu');
  insert into public.channel_summaries (restaurant_id, unit, op_date, channel, gross_sales, orders, fees) values (ra, 'Centro', '2026-11-10', 'grubhub', 100, 4, 15);
  -- fechamento: esperado calculado no servidor (50 + 180 − 30 − 10 = 190), mesmo com valor adulterado
  update public.cash_sessions set status = 'closed', counted_cash = 188, expected_cash = 999 where id = sid;
  select * into s from public.cash_sessions where id = sid;
  assert s.expected_cash = 190 and s.difference = -2, 'esperado 190, falta 2 (veio ' || s.expected_cash || ' / ' || s.difference || ')';
  assert s.closed_by = 'eeeeeeee-0000-0000-0000-000000000005', 'quem fechou fica registrado';
  begin
    update public.cash_sessions set counted_cash = 190 where id = sid;
    raise exception 'caixa fechado alterado sem motivo';
  exception when insufficient_privilege then null; end;
  begin
    perform public.correct_closed_session(sid, 190, '');
    raise exception 'correção sem motivo';
  exception when check_violation then null; end;
  perform public.correct_closed_session(sid, 189, 'Recontagem com o gerente');
  select * into s from public.cash_sessions where id = sid;
  assert s.counted_cash = 189 and s.difference = -1 and jsonb_array_length(s.corrections) = 1, 'correção registrada com motivo';
  begin
    insert into public.pos_sales (restaurant_id, session_id, op_date, code, client_token, items, subtotal, total) values (ra, sid, '2026-11-10', 'CX-3', gen_random_uuid(), '[]', 1, 1);
    raise exception 'venda em turno fechado';
  exception when check_violation then null; end;
  begin
    insert into public.pos_sale_events (restaurant_id, sale_id, kind, reason) values (ra, sale, 'cancel', 'erro');
    raise exception 'cancelou venda de turno fechado';
  exception when check_violation then null; end;
  -- segundo restaurante fora do acesso
  select count(*) into n from public.cash_sessions where restaurant_id <> ra; assert n = 0, 'não vê caixas de outro restaurante';
end $$;

-- Dono vê o que o operador fez; revoga o acesso
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'a@test.com', false);
do $$
declare n int; ra uuid; r2 uuid;
begin
  select id into ra from public.restaurants where name = 'Meu restaurante';
  select id into r2 from public.restaurants where name = 'Restaurante 2';
  select count(*) into n from public.pos_sales where restaurant_id = ra; assert n = 1, 'dono vê a venda do operador';
  insert into public.cash_sessions (restaurant_id, unit, op_date, opening_cash) values (ra, 'Centro', '2026-11-11', 20);
  insert into public.cash_sessions (restaurant_id, unit, op_date, opening_cash) values (r2, '', '2026-11-11', 0);
  delete from public.restaurant_members where email = 'op@test.com';
end $$;
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-000000000005', false);
select set_config('request.jwt.claim.email', 'op@test.com', false);
do $$
declare n int; sid uuid;
begin
  select count(*) into n from public.cash_sessions; assert n = 0, 'acesso revogado: nada visível';
  reset role;
  select id into sid from public.cash_sessions where op_date = '2026-11-11' and unit = 'Centro';
  set role authenticated;
  begin
    insert into public.pos_sales (restaurant_id, session_id, op_date, code, client_token, items, subtotal, total)
      select restaurant_id, id, op_date, 'CX-9', gen_random_uuid(), '[]', 5, 5 from public.cash_sessions where id = sid;
    get diagnostics n = row_count;
    assert n = 0, 'revogado não registra venda';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 007: painel administrativo -------------------------------------------------
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists created_at timestamptz default now();
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
update auth.users set email = 'a@test.com', email_confirmed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
\ir ../migrations/007_admin.sql
\ir ../migrations/007_admin.sql
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$
begin
  assert not public.is_app_admin(), 'não-admin';
  begin
    perform public.admin_overview();
    assert false, 'não-admin não pode ver o painel';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.app_admins (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002');
    assert false, 'ninguém se promove a admin pelo app';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.app_admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$
declare o jsonb; a jsonb; rd int; rr int; dd int;
begin
  assert public.is_app_admin(), 'admin';
  o := public.admin_overview();
  reset role;
  select count(*) into rd from public.restaurants;
  select count(*) into dd from public.dishes;
  select count(*) into rr from auth.users;
  assert (o->'totals'->>'users')::int = rr, 'total de usuários';
  assert (o->'totals'->>'restaurants')::int = rd, 'total de restaurantes';
  assert (o->'totals'->>'dishes')::int = dd, 'total de fichas';
  select x into a from jsonb_array_elements(o->'users') x where x->>'id' = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert (a->>'restaurantCount')::int = (select count(*) from public.restaurants where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'negócios do usuário A';
  assert (a->>'dishCount')::int = (select count(*) from public.dishes d join public.restaurants r on r.id = d.restaurant_id where r.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'fichas do usuário A';
  assert (a->>'isAdmin')::boolean and a->>'email' = 'a@test.com', 'dados do usuário A';
  assert (a->>'dishCount')::int >= 1, 'A tem ficha';
end $$;
reset role;

-- 008: lixeira de restaurantes ------------------------------------------------
\ir ../migrations/008_restaurant_trash.sql
\ir ../migrations/008_restaurant_trash.sql
reset role;
insert into public.restaurants (id, user_id, name) values ('dddddddd-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-000000000001', 'Típico Sweet & Salt');
insert into public.ingredients (id, user_id, restaurant_id, data) values ('ing-t1', 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', '{"id":"ing-t1"}');
insert into public.dishes (id, user_id, restaurant_id, data) values ('dish-t1', 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', '{"id":"dish-t1","itens":[{"ingredienteId":"ing-t1"}]}');
insert into public.restaurant_members (restaurant_id, email, role, status) values ('dddddddd-0000-0000-0000-00000000000d', 'b@test.com', 'operator', 'active');
insert into public.cash_sessions (id, restaurant_id, op_date, opening_cash) values ('eeeeeeee-0000-0000-0000-00000000000e', 'dddddddd-0000-0000-0000-00000000000d', '2026-11-11', 50);
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claim.email', 'a@test.com', false);
insert into public.pos_sales (restaurant_id, session_id, op_date, code, client_token, items, subtotal, total)
  values ('dddddddd-0000-0000-0000-00000000000d', 'eeeeeeee-0000-0000-0000-00000000000e', '2026-11-11', 'CX-T1', gen_random_uuid(), '[]', 12, 12);
insert into public.cash_movements (restaurant_id, session_id, kind, amount, reason) values ('dddddddd-0000-0000-0000-00000000000d', 'eeeeeeee-0000-0000-0000-00000000000e', 'supply', 5, 'troco');
do $$
declare n int; ok boolean;
begin
  -- nome errado é recusado; delete direto não apaga nada
  begin perform public.archive_restaurant('dddddddd-0000-0000-0000-00000000000d', 'Tipico Sweet & Salt'); assert false, 'nome sem acento não confirma';
  exception when invalid_parameter_value then null; end;
  delete from public.restaurants where id = 'dddddddd-0000-0000-0000-00000000000d';
  get diagnostics n = row_count; assert n = 0, 'app não apaga restaurante direto';
  -- outro usuário não exclui
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  perform set_config('request.jwt.claim.email', 'b@test.com', false);
  assert public.member_role('dddddddd-0000-0000-0000-00000000000d') = 'operator', 'operador ativo antes';
  begin perform public.archive_restaurant('dddddddd-0000-0000-0000-00000000000d', 'Típico Sweet & Salt'); assert false, 'só o dono exclui';
  exception when insufficient_privilege then null; end;
  -- dono exclui com o nome exato (espaços nas pontas tolerados)
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  perform set_config('request.jwt.claim.email', 'a@test.com', false);
  perform public.archive_restaurant('dddddddd-0000-0000-0000-00000000000d', '  Típico Sweet & Salt ');
  select count(*) into n from public.restaurants where id = 'dddddddd-0000-0000-0000-00000000000d' and deleted_at is not null;
  assert n = 1, 'dono ainda vê o restaurante na lixeira';
  assert not public.owns_restaurant('dddddddd-0000-0000-0000-00000000000d'), 'excluído não é editável';
  select count(*) into n from public.dishes where restaurant_id = 'dddddddd-0000-0000-0000-00000000000d'; assert n = 0, 'fichas ocultas enquanto excluído';
  update public.restaurants set name = 'X' where id = 'dddddddd-0000-0000-0000-00000000000d';
  get diagnostics n = row_count; assert n = 0, 'excluído não pode ser alterado';
  update public.restaurants set deleted_at = null where id = 'dddddddd-0000-0000-0000-00000000000d';
  get diagnostics n = row_count; assert n = 0, 'só reativa pela função';
  -- operador perde acesso
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
  perform set_config('request.jwt.claim.email', 'b@test.com', false);
  assert public.member_role('dddddddd-0000-0000-0000-00000000000d') is null, 'operador sem acesso ao excluído';
  select count(*) into n from public.restaurants where id = 'dddddddd-0000-0000-0000-00000000000d'; assert n = 0, 'operador não vê';
  select count(*) into n from public.cash_sessions where restaurant_id = 'dddddddd-0000-0000-0000-00000000000d'; assert n = 0, 'operador não vê o caixa';
  -- dono reativa: tudo volta
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  perform set_config('request.jwt.claim.email', 'a@test.com', false);
  assert public.restore_restaurant('dddddddd-0000-0000-0000-00000000000d'), 'reativado';
  select count(*) into n from public.dishes where restaurant_id = 'dddddddd-0000-0000-0000-00000000000d'; assert n = 1, 'fichas voltam';
  select count(*) into n from public.pos_sales where restaurant_id = 'dddddddd-0000-0000-0000-00000000000d'; assert n = 1, 'vendas voltam';
  assert public.owns_restaurant('dddddddd-0000-0000-0000-00000000000d'), 'editável de novo';
  perform public.archive_restaurant('dddddddd-0000-0000-0000-00000000000d', 'Típico Sweet & Salt');
end $$;
-- 91 dias depois: apagado de vez com tudo (inclusive caixa e vendas)
reset role;
update public.restaurants set deleted_at = now() - interval '91 days' where id = 'dddddddd-0000-0000-0000-00000000000d';
set role authenticated;
do $$
declare n int;
begin
  assert public.restore_restaurant('dddddddd-0000-0000-0000-00000000000d') = false, 'não reativa após 90 dias';
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.restaurants where id = 'dddddddd-0000-0000-0000-00000000000d'; assert n = 0, 'purgado';
  select count(*) into n from public.dishes where id = 'dish-t1'; assert n = 0, 'fichas purgadas';
  select count(*) into n from public.pos_sales where code = 'CX-T1'; assert n = 0, 'vendas purgadas';
  select count(*) into n from public.cash_sessions where id = 'eeeeeeee-0000-0000-0000-00000000000e'; assert n = 0, 'caixa purgado';
end $$;
select 'MIGRATION TESTS PASSED' as result;
