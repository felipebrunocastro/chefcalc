// Normalização de dados do Square (Orders, Payments, Payouts). Código puro: usado pela
// Edge Function square-sync e pelos testes do app.
import { emptyRecord, round2, type SalesRecord } from './salesRecord.ts';

interface Money { amount?: number | bigint | null; currency?: string | null }
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'CLP', 'VND', 'ISK', 'XAF', 'XOF', 'PYG', 'UGX']);
export function money(m?: Money | null): number {
  if (!m || m.amount == null) return 0;
  const exp = ZERO_DECIMAL.has((m.currency ?? '').toUpperCase()) ? 0 : 2;
  return Number(m.amount) / 10 ** exp;
}
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);

export interface SquareOrder {
  id: string; location_id?: string; reference_id?: string; ticket_name?: string;
  created_at?: string; closed_at?: string; state?: string;
  source?: { name?: string };
  total_money?: Money; total_tax_money?: Money; total_tip_money?: Money;
  net_amounts?: { total_money?: Money; tax_money?: Money; tip_money?: Money; discount_money?: Money };
  return_amounts?: { total_money?: Money };
}
export interface SquarePayment { id: string; order_id?: string; processing_fee?: { amount_money?: Money }[] }
export interface SquarePayout { id: string; location_id?: string; status?: string; amount_money?: Money; arrival_date?: string; created_at?: string }

// Canal a partir da origem do pedido informada pelo PDV.
export function squareChannel(sourceName?: string | null): string {
  const s = (sourceName ?? '').toLowerCase();
  if (s.includes('doordash')) return 'doordash';
  if (s.includes('uber')) return 'ubereats';
  if (s.includes('grubhub')) return 'grubhub';
  if (s.includes('online') || s.includes('website')) return 'direct';
  return 'counter';
}

export function normalizeSquareOrder(o: SquareOrder, fees: number, unitName: (locationId?: string) => string): SalesRecord {
  const net = o.net_amounts;
  const total = net?.total_money ? money(net.total_money) : money(o.total_money);
  const tax = net?.tax_money ? money(net.tax_money) : money(o.total_tax_money);
  const tip = net?.tip_money ? money(net.tip_money) : money(o.total_tip_money);
  const netSales = round2(total - tax - tip);
  return emptyRecord({
    source: 'square',
    recordKey: `order:${o.id}`,
    channel: squareChannel(o.source?.name),
    unit: unitName(o.location_id),
    kind: netSales < 0 ? 'refund' : 'order',
    externalOrderId: o.id,
    externalRef: o.reference_id || o.ticket_name || null,
    sourceName: o.source?.name ?? null,
    saleDate: day(o.closed_at || o.created_at),
    netSales,
    taxes: round2(tax),
    tips: round2(tip),
    otherFees: round2(fees),
    currency: o.total_money?.currency ?? null,
    raw: { id: o.id, state: o.state, location_id: o.location_id, source: o.source?.name ?? null },
  });
}

export function feesByOrder(payments: SquarePayment[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of payments) {
    if (!p.order_id) continue;
    const f = (p.processing_fee ?? []).reduce((a, x) => a + money(x.amount_money), 0);
    m.set(p.order_id, (m.get(p.order_id) ?? 0) + f);
  }
  return m;
}

export function normalizeSquarePayout(p: SquarePayout, unitName: (locationId?: string) => string): SalesRecord {
  return emptyRecord({
    source: 'square',
    recordKey: `payout:${p.id}`,
    channel: 'counter',
    unit: unitName(p.location_id),
    kind: 'payout',
    payoutDate: p.arrival_date ?? day(p.created_at),
    payout: round2(money(p.amount_money)),
    currency: p.amount_money?.currency ?? null,
    raw: { id: p.id, status: p.status },
  });
}
