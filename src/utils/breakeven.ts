import type { BudgetItem, DeliveryChannel, FinanceMonth, GoalsSettings, RestaurantProfile } from '../types';
import { splitItem, isEntered, monthSalesTotal } from './finance';

// Canais de venda: balcão, salão, pedidos diretos e as plataformas de delivery do perfil.
export const BASE_CHANNELS = ['counter', 'dinein', 'direct'] as const;

export const DEFAULT_DELIVERY: DeliveryChannel[] = [
  { id: 'doordash', name: 'DoorDash', active: false, url: '', feePct: null },
  { id: 'ubereats', name: 'Uber Eats', active: false, url: '', feePct: null },
  { id: 'grubhub', name: 'Grubhub', active: false, url: '', feePct: null },
  { id: 'own', name: '', active: false, url: '', feePct: null },
];

export interface Channel { id: string; name?: string; delivery: boolean; feePct: number | null }

export function salesChannels(profile: RestaurantProfile): Channel[] {
  const delivery = (profile.delivery?.length ? profile.delivery : DEFAULT_DELIVERY).filter(d => d.active || !profile.delivery?.length);
  return [
    ...BASE_CHANNELS.map(id => ({ id, delivery: false, feePct: null })),
    ...delivery.map(d => ({ id: d.id, name: d.name, delivery: true, feePct: d.feePct })),
  ];
}

// Dados faltantes (chaves i18n goals.missing.*) e premissas (goals.assumption.*).
export type Missing = 'referenceRevenue' | 'mixSum' | 'sales' | 'inventory' | 'month' | 'fixedCosts';
export type Assumption = 'purchasesAsCogs' | 'monthInProgress' | 'ownerPay' | 'mixFees' | 'pctItems' | 'importedSales' | 'importedFees';

export interface IncludedLine { label: string; kind: 'fixed' | 'variable'; amount?: number; pct?: number }

export interface Basis {
  source: 'budget' | 'month';
  period?: string;
  fixed: number;
  variableRate: number | null;   // fração das vendas líquidas (0.4 = 40%)
  included: IncludedLine[];
  missing: Missing[];
  assumptions: Assumption[];
  salesReference?: number;        // vendas usadas para converter $ em %
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function mixFeeRate(goals: GoalsSettings, channels: Channel[]): { rate: number | null; ok: boolean } {
  const mix = goals.mix ?? {};
  let shareSum = 0, rate = 0;
  for (const c of channels) {
    const m = mix[c.id];
    const share = finite(m?.share) ? m!.share! : 0;
    const fee = finite(m?.feePct) ? m!.feePct! : (finite(c.feePct) ? c.feePct : 0);
    shareSum += share;
    rate += (share / 100) * (fee / 100);
  }
  const ok = Math.abs(shareSum - 100) < 0.01;
  return { rate: ok ? rate : null, ok };
}

function ownerPay(goals: GoalsSettings, out: Basis) {
  if (goals.includeOwnerPay && finite(goals.ownerPay) && goals.ownerPay > 0) {
    out.fixed += goals.ownerPay;
    out.included.push({ label: 'ownerPay', kind: 'fixed', amount: goals.ownerPay });
    out.assumptions.push('ownerPay');
  }
}

// Base = orçamento de referência (simulação).
export function basisFromBudget(budget: BudgetItem[], goals: GoalsSettings, profile: RestaurantProfile): Basis {
  const out: Basis = { source: 'budget', fixed: 0, variableRate: null, included: [], missing: [], assumptions: [] };
  const useMix = !!goals.useMix;
  let pct = 0, money = 0;
  for (const i of budget) {
    if (useMix && i.natureza === 'fees' && i.tipo !== 'fixed') continue; // taxas vêm do mix por canal
    const p = splitItem(i);
    if (p.fixed) { out.fixed += p.fixed; out.included.push({ label: i.categoria, kind: 'fixed', amount: p.fixed }); }
    if (p.variable) { money += p.variable; out.included.push({ label: i.categoria, kind: 'variable', amount: p.variable }); }
    if (p.pct) { pct += p.pct; out.included.push({ label: i.categoria, kind: 'variable', pct: p.pct }); }
  }
  ownerPay(goals, out);
  if (pct > 0) out.assumptions.push('pctItems');
  let rate = pct / 100;
  if (money > 0) {
    if (finite(goals.referenceRevenue) && goals.referenceRevenue > 0) {
      rate += money / goals.referenceRevenue;
      out.salesReference = goals.referenceRevenue;
    } else out.missing.push('referenceRevenue');
  }
  if (useMix) {
    const mf = mixFeeRate(goals, salesChannels(profile));
    if (!mf.ok) out.missing.push('mixSum');
    else { rate += mf.rate!; out.assumptions.push('mixFees'); out.included.push({ label: 'mixFees', kind: 'variable', pct: mf.rate! * 100 }); }
  }
  if (out.fixed <= 0) out.missing.push('fixedCosts');
  out.variableRate = out.missing.some(m => m === 'referenceRevenue' || m === 'mixSum') ? null : rate;
  return out;
}

// Base = mês real (de preferência fechado).
export function basisFromMonth(month: FinanceMonth | undefined, goals: GoalsSettings): Basis {
  const out: Basis = { source: 'month', period: month?.period, fixed: 0, variableRate: null, included: [], missing: [], assumptions: [] };
  if (!month) { out.missing.push('month'); return out; }
  if (month.status !== 'closed') out.assumptions.push('monthInProgress');
  let variable = 0, purchases = 0;
  const importedFees = month.sales?.imported?.fees ?? {};
  const feeChannels = new Set(Object.keys(importedFees).filter(k => importedFees[k] !== 0));
  for (const e of month.entries) {
    if (!isEntered(e)) continue;
    // Taxas do canal importado vêm do extrato da plataforma: o lançamento manual do mesmo canal não soma.
    if (e.plataforma && feeChannels.has(e.plataforma)) continue;
    const p = splitItem({ ...e, unidade: 'money' });
    if (p.fixed) { out.fixed += p.fixed; out.included.push({ label: e.categoria, kind: 'fixed', amount: p.fixed }); }
    if (!p.variable) continue;
    if (e.natureza === 'cogs') purchases += p.variable;
    else { variable += p.variable; out.included.push({ label: e.categoria, kind: 'variable', amount: p.variable }); }
  }
  if (feeChannels.size) {
    const f = [...feeChannels].reduce((a, k) => a + importedFees[k], 0);
    variable += f; out.included.push({ label: 'importedFees', kind: 'variable', amount: f });
    out.assumptions.push('importedFees');
  }
  ownerPay(goals, out);
  // CMV: custo efetivamente consumido = estoque inicial + compras − estoque final.
  const s = month.sales ?? {};
  if (purchases > 0 || finite(s.inventoryStart) || finite(s.inventoryEnd)) {
    if ((goals.cogsMode ?? 'consumed') === 'consumed') {
      if (finite(s.inventoryStart) && finite(s.inventoryEnd)) {
        const cogs = s.inventoryStart + purchases - s.inventoryEnd;
        variable += cogs; out.included.push({ label: 'cogsConsumed', kind: 'variable', amount: cogs });
      } else out.missing.push('inventory');
    } else {
      variable += purchases; out.included.push({ label: 'cogsPurchases', kind: 'variable', amount: purchases });
      out.assumptions.push('purchasesAsCogs');
    }
  }
  const sales = monthSalesTotal(month);
  if (sales.imported) out.assumptions.push('importedSales');
  if (!sales.informed || sales.total <= 0) out.missing.push('sales');
  else out.salesReference = sales.total;
  if (out.fixed <= 0) out.missing.push('fixedCosts');
  out.variableRate = out.missing.includes('sales') || out.missing.includes('inventory') ? null : variable / sales.total;
  return out;
}

export type TargetStatus = 'ok' | 'noBreakeven' | 'infeasible' | 'missing';

export interface TargetResult { status: TargetStatus; monthly?: number; daily?: number; ordersPerDay?: number }

export interface Results {
  contributionMargin: number | null;
  breakeven: TargetResult;
  byMargin: (marginPct: number) => TargetResult;
  byProfit: (profit: number) => TargetResult;
}

// Pedidos por dia: ticket médio geral; ou, com mix e tickets por canal, Σ(meta × participação ÷ ticket).
export function ordersPerDay(daily: number, profile: RestaurantProfile, goals: GoalsSettings): number | undefined {
  if (finite(profile.avgTicket) && profile.avgTicket > 0) return Math.ceil(daily / profile.avgTicket - 1e-9);
  const mix = goals.mix ?? {};
  const tickets = profile.ticketByChannel ?? {};
  const entries = Object.entries(mix).filter(([, m]) => finite(m.share) && m.share! > 0);
  if (!goals.useMix || entries.length === 0) return undefined;
  let orders = 0;
  for (const [id, m] of entries) {
    const tk = tickets[id];
    if (!finite(tk) || tk <= 0) return undefined;
    orders += (daily * (m.share! / 100)) / tk;
  }
  return Math.ceil(orders - 1e-9);
}

export function computeTargets(b: Basis, profile: RestaurantProfile, goals: GoalsSettings): Results {
  const cm = b.variableRate === null ? null : 1 - b.variableRate;
  const days = finite(profile.openDaysPerMonth) && profile.openDaysPerMonth > 0 ? profile.openDaysPerMonth : undefined;
  const finish = (monthly: number): TargetResult => {
    const daily = days ? monthly / days : undefined;
    return { status: 'ok', monthly, daily, ordersPerDay: daily !== undefined ? ordersPerDay(daily, profile, goals) : undefined };
  };
  const blocked = (): TargetResult | null => {
    if (cm === null || b.missing.includes('fixedCosts')) return { status: 'missing' };
    if (cm <= 0) return { status: 'noBreakeven' };
    return null;
  };
  return {
    contributionMargin: cm,
    breakeven: blocked() ?? finish(b.fixed / cm!),
    byMargin: (marginPct: number) => {
      const x = blocked(); if (x) return x;
      const m = marginPct / 100;
      if (m >= cm!) return { status: 'infeasible' };
      return finish(b.fixed / (cm! - m));
    },
    byProfit: (profit: number) => {
      const x = blocked(); if (x) return x;
      return finish((b.fixed + profit) / cm!);
    },
  };
}

// Mediana setorial dos EUA (lucro antes dos impostos), NRA — 2025 Restaurant Operations Data Abstract.
export const NRA_REFERENCE = {
  year: 2025,
  full: 2.8,
  limited: 4.0,
  url: 'https://restaurant.org/research-and-media/media/press-releases/new-resource-from-national-restaurant-association-provides-insights-into-operational-realities/',
};

export const DEFAULT_SCENARIOS = [5, 8, 10];
