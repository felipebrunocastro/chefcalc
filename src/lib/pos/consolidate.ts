import type { SalesRecord } from '../imports/normalize';
import { countsInTotals } from '../imports/reconcile';
import type { CashSession, ChannelSummary, Payment, PosSale, SaleEvent, SourceKind } from './types';

// Base única de vendas conciliadas (Caixa, Calendário e Financeiro).
// Separa canal de venda, forma de pagamento e origem do registro.

const r2 = (n: number) => Math.round(n * 100) / 100;
const DELIVERY = new Set(['doordash', 'ubereats', 'grubhub']);

export interface Line {
  date: string; unit: string; channel: string; payment: Payment; source: SourceKind;
  net: number; orders: number | null; fees: number; payout: number | null; payoutDate: string | null;
  products?: { name: string; qty: number; total: number }[]; ref: string;
}

export interface ConsolidateInput {
  sales: PosSale[]; events: SaleEvent[]; sessions: CashSession[]; summaries: ChannelSummary[]; records: SalesRecord[];
  expectedChannels: string[];  // canais que precisam de relatório (ex.: plataformas ativas)
}

export interface Filters { unit?: string; channel?: string; payment?: Payment }

export interface Conflict {
  kind: 'detailedVsSummary' | 'aggregateOverlap' | 'squareReview';
  date: string; unit: string; channel: string; summaryId?: string; amount: number; detailedAmount?: number;
}

export type DayStatus = 'none' | 'zero' | 'open' | 'pending' | 'consolidated';

export interface DayResult {
  date: string; net: number; orders: number | null; ticket: number | null;
  byChannel: Record<string, { net: number; orders: number | null; sources: SourceKind[]; productDetail: boolean }>;
  byPayment: Record<string, number>;
  products: { name: string; qty: number; total: number }[];
  productChannels: string[];       // canais cobertos pelo ranking de produtos
  fees: number; payouts: number;   // repasses pela data do repasse (indicador separado)
  status: DayStatus; physicalClosed: boolean; consolidated: boolean; provisional: boolean;
  pendingChannels: string[]; pendingAmount: number; conflicts: Conflict[]; sessions: CashSession[];
}

const paymentOf = (r: SalesRecord): Payment =>
  (r as SalesRecord & { paymentMethod?: Payment }).paymentMethod ?? (DELIVERY.has(r.channel) ? 'online' : 'other');

export function buildLines(inp: ConsolidateInput): { lines: Line[]; conflicts: Conflict[] } {
  const lines: Line[] = [];
  const conflicts: Conflict[] = [];
  // 1) Vendas do caixa ChefCalc (dinheiro, com produtos). Reembolsos reduzem as vendas na data da venda.
  const refundsBySale = new Map<string, number>();
  for (const e of inp.events) if (e.kind === 'refund') refundsBySale.set(e.saleId, (refundsBySale.get(e.saleId) ?? 0) + e.amount);
  for (const s of inp.sales) {
    if (s.status !== 'completed') continue;
    const refunded = refundsBySale.get(s.id) ?? 0;
    const taxShare = s.total > 0 ? s.tax / s.total : 0;           // vendas líquidas excluem imposto
    const net = r2((s.total - refunded) * (1 - taxShare));
    lines.push({
      date: s.opDate, unit: s.unit, channel: s.channel, payment: s.payment, source: 'chefcalc', net, orders: 1, fees: 0, payout: null, payoutDate: null,
      products: s.items.map(i => ({ name: i.name + (i.size ? ` (${i.size})` : ''), qty: i.qty, total: r2(i.lineTotal * (s.total > 0 ? (s.total - refunded) / s.total : 0) * (1 - taxShare)) })),
      ref: s.id,
    });
  }
  // 2) Relatórios detalhados (Square, CSV). Square conciliado com plataforma/caixa não conta de novo.
  const keyed = new Map<string, Line[]>();
  for (const r of inp.records) {
    if (r.kind === 'payout') {
      lines.push({ date: '', unit: r.unit, channel: r.channel, payment: paymentOf(r), source: r.source === 'square' ? 'square' : 'csv', net: 0, orders: null, fees: 0, payout: r.payout, payoutDate: r.payoutDate, ref: `${r.source}|${r.recordKey}` });
      continue;
    }
    if (!r.saleDate) continue;
    if (r.source === 'square' && r.matchStatus === 'review') conflicts.push({ kind: 'squareReview', date: r.saleDate, unit: r.unit, channel: r.channel, amount: r.netSales });
    if (!countsInTotals(r)) continue;
    const l: Line = {
      date: r.saleDate, unit: r.unit, channel: r.channel, payment: paymentOf(r), source: r.source === 'square' ? 'square' : 'csv',
      net: r.netSales, orders: r.kind === 'order' ? 1 : 0, fees: r.commissions + r.promotions + r.otherFees,
      payout: r.payout, payoutDate: r.payoutDate, ref: `${r.source}|${r.recordKey}`,
    };
    const k = `${l.date}|${l.unit}|${l.channel}`;
    keyed.set(k, [...(keyed.get(k) ?? []), l]);
    lines.push(l);
  }
  // 3) Resumos manuais por plataforma e unidade.
  for (const s of inp.summaries) {
    if (s.status === 'replaced' || s.channel === '__day__') continue;
    const channel = s.channel === 'square'
      ? (s.includes.channels?.length === 1 ? s.includes.channels[0] : 'counter')
      : s.channel;
    const net = r2(s.grossSales - s.discounts - s.refunds);
    const detailedKey = `${s.opDate}|${s.unit}|${channel}`;
    const detailed = s.channel !== 'square' ? keyed.get(detailedKey) : undefined;
    if (detailed?.length) {
      if (s.status === 'kept') {
        // resumo mantido: os detalhados do mesmo dia/canal saem da soma
        for (const d of detailed) { const i = lines.indexOf(d); if (i >= 0) lines.splice(i, 1); }
      } else {
        // relatório detalhado chegou depois: provisório até revisar (conta o resumo)
        const dAmount = r2(detailed.reduce((a, d) => a + d.net, 0));
        conflicts.push({ kind: 'detailedVsSummary', date: s.opDate, unit: s.unit, channel, summaryId: s.id, amount: net, detailedAmount: dAmount });
        for (const d of detailed) { const i = lines.indexOf(d); if (i >= 0) lines.splice(i, 1); }
      }
    }
    let netCounted = net;
    // Total agregado do Square: sobreposição com vendas já registradas por outras origens
    if (s.channel === 'square' && (s.includes.channels?.length || s.includes.payments?.length)) {
      const inc = new Set(s.includes.channels ?? []);
      const pay = new Set(s.includes.payments ?? []);
      const overlap = r2(lines.filter(l => l.date === s.opDate && l.unit === s.unit && l.source !== 'square' && l.source !== 'manual'
        && (inc.has(l.channel) || pay.has(l.payment))).reduce((a, l) => a + l.net, 0));
      if (overlap > 0) {
        if (s.overlapResolution === 'deduct') netCounted = r2(net - overlap);
        else if (s.overlapResolution !== 'separate') conflicts.push({ kind: 'aggregateOverlap', date: s.opDate, unit: s.unit, channel, summaryId: s.id, amount: overlap });
      }
    }
    const payment: Payment = s.channel === 'square' ? (s.includes.payments?.length === 1 ? s.includes.payments[0] : 'other') : DELIVERY.has(s.channel) ? 'online' : 'other';
    lines.push({ date: s.opDate, unit: s.unit, channel, payment, source: 'manual', net: netCounted, orders: s.orders, fees: s.fees, payout: s.payout, payoutDate: s.payoutDate, ref: s.id });
  }
  return { lines, conflicts };
}

const match = (l: Line, f: Filters) => (!f.unit || l.unit === f.unit) && (!f.channel || l.channel === f.channel) && (!f.payment || l.payment === f.payment);

export function dayResult(date: string, inp: ConsolidateInput, built: { lines: Line[]; conflicts: Conflict[] }, f: Filters = {}): DayResult {
  const lines = built.lines.filter(l => l.date === date && match(l, f));
  const conflicts = built.conflicts.filter(c => c.date === date && (!f.unit || c.unit === f.unit) && (!f.channel || c.channel === f.channel));
  const byChannel: DayResult['byChannel'] = {};
  const byPayment: Record<string, number> = {};
  const productMap = new Map<string, { name: string; qty: number; total: number }>();
  let ordersKnown = true, orders = 0;
  for (const l of lines) {
    const c = byChannel[l.channel] ?? (byChannel[l.channel] = { net: 0, orders: 0, sources: [], productDetail: true });
    c.net = r2(c.net + l.net);
    if (l.orders === null) { c.orders = null; ordersKnown = false; } else if (c.orders !== null) c.orders += l.orders;
    if (l.orders !== null) orders += l.orders;
    if (!c.sources.includes(l.source)) c.sources.push(l.source);
    if (!l.products) c.productDetail = false;
    byPayment[l.payment] = r2((byPayment[l.payment] ?? 0) + l.net);
    for (const p of l.products ?? []) {
      const e = productMap.get(p.name) ?? { name: p.name, qty: 0, total: 0 };
      e.qty += p.qty; e.total = r2(e.total + p.total); productMap.set(p.name, e);
    }
  }
  const net = r2(lines.reduce((a, l) => a + l.net, 0));
  const fees = r2(lines.reduce((a, l) => a + l.fees, 0));
  const payouts = r2(built.lines.filter(l => l.payoutDate === date && l.payout != null && match(l, f)).reduce((a, l) => a + (l.payout ?? 0), 0));
  const sessions = inp.sessions.filter(s => s.opDate === date && (!f.unit || s.unit === f.unit));
  const daySummaries = inp.summaries.filter(s => s.opDate === date && (!f.unit || s.unit === f.unit) && s.status !== 'replaced');
  const zeroConfirmed = daySummaries.some(s => s.channel === '__day__');
  const registered = new Set([...Object.keys(byChannel), ...daySummaries.map(s => s.channel)]);
  if (daySummaries.some(s => s.channel === 'square')) registered.add('square');
  const anyActivity = sessions.length > 0 || lines.length > 0 || daySummaries.length > 0;
  const pendingChannels = anyActivity && !zeroConfirmed ? inp.expectedChannels.filter(c => !registered.has(c) && (!f.channel || f.channel === c)) : [];
  const physicalClosed = sessions.length > 0 && sessions.every(s => s.status === 'closed');
  const open = sessions.some(s => s.status === 'open');
  const provisional = conflicts.length > 0;
  const pendingAmount = r2(conflicts.reduce((a, c) => a + c.amount, 0));
  const consolidated = !open && !provisional && pendingChannels.length === 0 && (lines.length > 0 || zeroConfirmed);
  let status: DayStatus = 'none';
  if (open) status = 'open';
  else if (zeroConfirmed && net === 0 && !provisional) status = 'zero';
  else if (consolidated) status = 'consolidated';
  else if (anyActivity) status = 'pending';
  const productChannels = Object.entries(byChannel).filter(([, c]) => c.productDetail).map(([ch]) => ch);
  // Ticket médio só quando pedidos e vendas cobrem o mesmo conjunto de registros.
  const ticket = ordersKnown && orders > 0 ? r2(net / orders) : null;
  return {
    date, net, orders: ordersKnown ? orders : null, ticket, byChannel, byPayment,
    products: [...productMap.values()].sort((a, b) => b.total - a.total), productChannels,
    fees, payouts, status, physicalClosed, consolidated, provisional, pendingChannels, pendingAmount, conflicts, sessions,
  };
}

export interface RangeResult { from: string; to: string; net: number; orders: number | null; ticket: number | null; byChannel: Record<string, number>; days: DayResult[]; daysWithSales: number; fees: number; payouts: number }

export function rangeResult(from: string, to: string, inp: ConsolidateInput, built: { lines: Line[]; conflicts: Conflict[] }, f: Filters = {}): RangeResult {
  const days: DayResult[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(dayResult(d.toISOString().slice(0, 10), inp, built, f));
  }
  const byChannel: Record<string, number> = {};
  for (const day of days) for (const [ch, c] of Object.entries(day.byChannel)) byChannel[ch] = r2((byChannel[ch] ?? 0) + c.net);
  const net = r2(days.reduce((a, d) => a + d.net, 0));
  const ordersKnown = days.every(d => d.orders !== null || d.net === 0);
  const orders = days.reduce((a, d) => a + (d.orders ?? 0), 0);
  return {
    from, to, net, byChannel, days, daysWithSales: days.filter(d => d.net !== 0).length,
    orders: ordersKnown ? orders : null, ticket: ordersKnown && orders > 0 ? r2(net / orders) : null,
    fees: r2(days.reduce((a, d) => a + d.fees, 0)), payouts: r2(days.reduce((a, d) => a + d.payouts, 0)),
  };
}

// Camada do Financeiro (vendas, taxas e repasses por canal no mês) a partir da mesma base.
export function monthLayer(period: string, inp: ConsolidateInput, built: { lines: Line[]; conflicts: Conflict[] }) {
  const channels: Record<string, number> = {}, fees: Record<string, number> = {}, payouts: Record<string, number> = {};
  let n = 0;
  for (const l of built.lines) {
    if (l.date.slice(0, 7) === period) { channels[l.channel] = r2((channels[l.channel] ?? 0) + l.net); fees[l.channel] = r2((fees[l.channel] ?? 0) + l.fees); n++; }
    if (l.payoutDate?.slice(0, 7) === period && l.payout != null) payouts[l.channel] = r2((payouts[l.channel] ?? 0) + l.payout);
  }
  void inp;
  return { channels, fees, payouts, recordCount: n, provisional: built.conflicts.some(c => c.date.slice(0, 7) === period) };
}

// Semana de segunda a domingo (pode atravessar dois meses).
export function weekRange(date: string): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  const from = new Date(d); from.setUTCDate(d.getUTCDate() - dow);
  const to = new Date(from); to.setUTCDate(from.getUTCDate() + 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

// Vendas do caixa como registros para a conciliação com o Square (nº da venda = código CX-...).
export function salesAsRecords(sales: PosSale[]): SalesRecord[] {
  return sales.filter(s => s.status === 'completed').map(s => ({
    source: 'chefcalc', recordKey: s.id, channel: s.channel, unit: s.unit, kind: 'order' as const,
    externalOrderId: s.code, externalRef: null, sourceName: 'ChefCalc', saleDate: s.opDate, payoutDate: null,
    netSales: r2(s.total - s.tax), commissions: 0, promotions: 0, otherFees: 0, taxes: s.tax, tips: 0, adjustments: 0,
    payout: null, currency: null, paymentMethod: s.payment, matchStatus: 'none' as const, matchedSource: null, matchedKey: null,
  }));
}

