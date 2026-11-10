// Sincroniza pedidos, taxas de processamento e repasses do Square para sales_records.
// Deploy: supabase functions deploy square-sync
// Reexecutar períodos sobrepostos atualiza os mesmos registros (chave = id do Square).
import { cors, json, serviceClient, squareBase, squareFetch, userClient } from '../_shared/squareApi.ts';
import { feesByOrder, normalizeSquareOrder, normalizeSquarePayout, type SquareOrder, type SquarePayment, type SquarePayout } from '../_shared/square.ts';
import type { SalesRecord } from '../_shared/salesRecord.ts';

const APP_ID = Deno.env.get('SQUARE_APPLICATION_ID')!;
const APP_SECRET = Deno.env.get('SQUARE_APPLICATION_SECRET')!;

async function token(admin: ReturnType<typeof serviceClient>, restaurantId: string): Promise<string> {
  const { data: sec } = await admin.from('integration_secrets').select('*').eq('restaurant_id', restaurantId).eq('provider', 'square').maybeSingle();
  if (!sec) throw new Error('Square não conectado');
  if (sec.expires_at && Date.parse(sec.expires_at) - Date.now() < 5 * 60_000 && sec.refresh_token) {
    const res = await fetch(`${squareBase()}/oauth2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: APP_ID, client_secret: APP_SECRET, grant_type: 'refresh_token', refresh_token: sec.refresh_token }),
    });
    const tok = await res.json();
    if (!res.ok || !tok.access_token) throw new Error('Falha ao renovar o acesso ao Square');
    await admin.from('integration_secrets').update({ access_token: tok.access_token, refresh_token: tok.refresh_token ?? sec.refresh_token, expires_at: tok.expires_at ?? null, updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId).eq('provider', 'square');
    return tok.access_token;
  }
  return sec.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { restaurantId, start, end } = await req.json().catch(() => ({}));
  if (!restaurantId || !/^\d{4}-\d{2}-\d{2}$/.test(start ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? '')) return json({ error: 'Parâmetros inválidos' }, 400);

  // Permissão: dono ou papel 'finance' (o RLS só devolve a linha para quem pode).
  const { data: integ } = await userClient(req).from('integrations').select('locations').eq('restaurant_id', restaurantId).eq('provider', 'square').maybeSingle();
  if (!integ) return json({ error: 'Sem permissão ou Square não conectado' }, 403);

  const admin = serviceClient();
  try {
    const tk = await token(admin, restaurantId);
    const locations: { id: string; name: string }[] = integ.locations ?? [];
    const unitName = (id?: string) => locations.find(l => l.id === id)?.name ?? '';
    const begin = `${start}T00:00:00Z`, finish = `${end}T23:59:59Z`;

    const orders: SquareOrder[] = [];
    for (let i = 0; i < locations.length; i += 10) {
      let cursor: string | undefined;
      do {
        const r = await squareFetch('/v2/orders/search', tk, { method: 'POST', body: JSON.stringify({
          location_ids: locations.slice(i, i + 10).map(l => l.id), cursor, limit: 500,
          query: { filter: { date_time_filter: { closed_at: { start_at: begin, end_at: finish } }, state_filter: { states: ['COMPLETED'] } }, sort: { sort_field: 'CLOSED_AT', sort_order: 'ASC' } },
        }) });
        orders.push(...(r.orders ?? []));
        cursor = r.cursor;
      } while (cursor);
    }
    const payments: SquarePayment[] = [];
    const payouts: SquarePayout[] = [];
    for (const l of locations) {
      let cursor: string | undefined;
      do {
        const q = new URLSearchParams({ begin_time: begin, end_time: finish, location_id: l.id, ...(cursor ? { cursor } : {}) });
        const r = await squareFetch(`/v2/payments?${q}`, tk);
        payments.push(...(r.payments ?? []));
        cursor = r.cursor;
      } while (cursor);
      cursor = undefined;
      do {
        const q = new URLSearchParams({ begin_time: begin, end_time: finish, location_id: l.id, ...(cursor ? { cursor } : {}) });
        const r = await squareFetch(`/v2/payouts?${q}`, tk);
        payouts.push(...(r.payouts ?? []).filter((p: SquarePayout) => p.status === 'PAID'));
        cursor = r.cursor;
      } while (cursor);
    }

    const fees = feesByOrder(payments);
    const records: SalesRecord[] = [
      ...orders.map(o => normalizeSquareOrder(o, fees.get(o.id) ?? 0, unitName)),
      ...payouts.map(p => normalizeSquarePayout(p, unitName)),
    ];

    // Preserva decisões de conciliação já tomadas.
    const { data: existing } = await admin.from('sales_records').select('record_key, match_status, matched_source, matched_key')
      .eq('restaurant_id', restaurantId).eq('source', 'square').in('record_key', records.map(r => r.recordKey).slice(0, 5000));
    const prev = new Map((existing ?? []).map(e => [e.record_key, e]));

    const { data: batch } = await admin.from('import_batches').insert({
      restaurant_id: restaurantId, source: 'square', channel: 'counter', unit: '', period_start: start, period_end: end,
      row_count: records.length, inserted: records.filter(r => !prev.has(r.recordKey)).length, updated: records.filter(r => prev.has(r.recordKey)).length,
      summary: { orders: orders.length, payouts: payouts.length },
    }).select('id').single();

    const rows = records.map(r => {
      const p = prev.get(r.recordKey);
      return {
        restaurant_id: restaurantId, source: 'square', record_key: r.recordKey, channel: r.channel, unit: r.unit, kind: r.kind,
        external_order_id: r.externalOrderId, external_ref: r.externalRef, source_name: r.sourceName,
        sale_date: r.saleDate, payout_date: r.payoutDate, net_sales: r.netSales, commissions: 0, promotions: 0,
        other_fees: r.otherFees, taxes: r.taxes, tips: r.tips, adjustments: 0, payout: r.payout, currency: r.currency,
        match_status: p?.match_status ?? 'none', matched_source: p?.matched_source ?? null, matched_key: p?.matched_key ?? null,
        batch_id: batch?.id ?? null, raw: r.raw, updated_at: new Date().toISOString(),
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from('sales_records').upsert(rows.slice(i, i + 500), { onConflict: 'restaurant_id,source,record_key' });
      if (error) throw error;
    }
    await admin.from('integrations').update({ last_sync_at: new Date().toISOString(), last_error: null, status: 'connected' }).eq('restaurant_id', restaurantId).eq('provider', 'square');
    return json({ inserted: rows.filter(r => !prev.has(r.record_key)).length, updated: rows.filter(r => prev.has(r.record_key)).length, orders: orders.length, payouts: payouts.length });
  } catch (e) {
    await admin.from('integrations').update({ last_error: String(e).slice(0, 300) }).eq('restaurant_id', restaurantId).eq('provider', 'square');
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
