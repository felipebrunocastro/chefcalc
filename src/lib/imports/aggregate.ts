import { round2 } from '../../../supabase/functions/_shared/salesRecord.ts';
import type { SalesRecord } from './normalize';
import { countsInTotals } from './reconcile';

export interface ChannelSummary {
  channel: string;
  netSales: number; commissions: number; promotions: number; otherFees: number;
  taxes: number; tips: number; adjustments: number;
  orders: number; refunds: number;
  payoutsInMonth: number;          // repasses com data de repasse no mês
  salesPaidLater: number;          // vendas do mês com repasse em mês posterior
  effectiveFeeRate: number | null; // (comissões + promoções + outras taxas) ÷ vendas líquidas
  payoutDivergences: number;       // registros cujo repasse não bate com o esperado
}

export interface MonthSummary {
  period: string;
  channels: ChannelSummary[];
  totals: { netSales: number; fees: number; payouts: number };
  review: number;
  reviewAmount: number;            // vendas do Square aguardando revisão (fora dos totais)
  divergences: number;
  recordCount: number;
}

const inMonth = (d: string | null, p: string) => !!d && d.slice(0, 7) === p;
const fees = (r: SalesRecord) => r.commissions + r.promotions + r.otherFees;

// Repasse esperado de um pedido; a plataforma pode ou não repassar o imposto (marketplace facilitator).
export function payoutMatches(r: SalesRecord): boolean {
  if (r.payout == null || r.kind === 'payout') return true;
  const base = r.netSales + r.tips + r.adjustments - fees(r);
  return Math.abs(r.payout - base) <= 0.05 || Math.abs(r.payout - (base + r.taxes)) <= 0.05;
}

export function summarizeMonth(records: SalesRecord[], period: string, unit?: string): MonthSummary {
  const rs = records.filter(r => !unit || r.unit === unit);
  const map = new Map<string, ChannelSummary>();
  const get = (ch: string) => {
    if (!map.has(ch)) map.set(ch, { channel: ch, netSales: 0, commissions: 0, promotions: 0, otherFees: 0, taxes: 0, tips: 0, adjustments: 0, orders: 0, refunds: 0, payoutsInMonth: 0, salesPaidLater: 0, effectiveFeeRate: null, payoutDivergences: 0 });
    return map.get(ch)!;
  };
  let review = 0, reviewAmount = 0;
  for (const r of rs) {
    if (r.matchStatus === 'review' && r.source === 'square' && inMonth(r.saleDate, period)) { review++; reviewAmount += r.netSales; }
    if (!countsInTotals(r)) continue;
    if (inMonth(r.saleDate, period) && r.kind !== 'payout') {
      const c = get(r.channel);
      c.netSales += r.netSales; c.commissions += r.commissions; c.promotions += r.promotions; c.otherFees += r.otherFees;
      c.taxes += r.taxes; c.tips += r.tips; c.adjustments += r.adjustments;
      if (r.kind === 'order') c.orders++;
      if (r.kind === 'refund') c.refunds += r.netSales;
      if (r.payoutDate && r.payoutDate.slice(0, 7) > period) c.salesPaidLater += r.netSales;
      if (!payoutMatches(r)) c.payoutDivergences++;
    }
    if (inMonth(r.payoutDate, period) && r.payout != null) get(r.channel).payoutsInMonth += r.payout;
  }
  const channels = [...map.values()].map(c => {
    const out = { ...c };
    for (const k of ['netSales', 'commissions', 'promotions', 'otherFees', 'taxes', 'tips', 'adjustments', 'refunds', 'payoutsInMonth', 'salesPaidLater'] as const) out[k] = round2(out[k]);
    out.effectiveFeeRate = out.netSales > 0 ? (out.commissions + out.promotions + out.otherFees) / out.netSales : null;
    return out;
  }).sort((a, b) => b.netSales - a.netSales);
  const divergences = review + channels.reduce((a, c) => a + c.payoutDivergences, 0);
  return {
    period, channels, review, divergences, reviewAmount: round2(reviewAmount),
    recordCount: rs.filter(r => inMonth(r.saleDate, period) || inMonth(r.payoutDate, period)).length,
    totals: {
      netSales: round2(channels.reduce((a, c) => a + c.netSales, 0)),
      fees: round2(channels.reduce((a, c) => a + c.commissions + c.promotions + c.otherFees, 0)),
      payouts: round2(channels.reduce((a, c) => a + c.payoutsInMonth, 0)),
    },
  };
}
