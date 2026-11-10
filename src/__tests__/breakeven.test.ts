import { describe, it, expect } from 'vitest';
import { basisFromBudget, basisFromMonth, computeTargets, ordersPerDay } from '../utils/breakeven';
import type { BudgetItem, FinanceMonth, GoalsSettings, RestaurantProfile } from '../types';

const profile: RestaurantProfile = { openDaysPerMonth: 26, avgTicket: 25 };
const budget: BudgetItem[] = [
  { id: '1', categoria: 'Fixos', descricao: '', tipo: 'fixed', valor: 10000 },
  { id: '2', categoria: 'Variáveis', descricao: '', tipo: 'variable', valor: 40, unidade: 'pct' },
];

describe('ponto de equilíbrio', () => {
  it('US$ 10.000 fixos e 40% variáveis → 16.666,67; margem 8% → 19.230,77', () => {
    const b = basisFromBudget(budget, {}, profile);
    const r = computeTargets(b, profile, {});
    expect(r.contributionMargin).toBeCloseTo(0.6);
    expect(r.breakeven.monthly!).toBeCloseTo(16666.67, 2);
    expect(r.byMargin(8).monthly!).toBeCloseTo(19230.77, 2);
    expect(r.byProfit(2000).monthly!).toBeCloseTo(20000, 2);
    // por dia e pedidos
    expect(r.breakeven.daily!).toBeCloseTo(16666.67 / 26, 2);
    expect(r.breakeven.ordersPerDay).toBe(Math.ceil(16666.67 / 26 / 25));
  });

  it('meta inviável quando margem desejada ≥ margem de contribuição', () => {
    const r = computeTargets(basisFromBudget(budget, {}, profile), profile, {});
    expect(r.byMargin(60).status).toBe('infeasible');
    expect(r.byMargin(75).status).toBe('infeasible');
  });

  it('margem de contribuição zero ou negativa não alcança o equilíbrio', () => {
    const b = basisFromBudget([budget[0], { ...budget[1], valor: 100 }], {}, profile);
    expect(computeTargets(b, profile, {}).breakeven.status).toBe('noBreakeven');
  });

  it('variáveis em dinheiro exigem faturamento de referência', () => {
    const items: BudgetItem[] = [budget[0], { id: '3', categoria: 'Ingredientes', descricao: '', tipo: 'variable', valor: 6000, natureza: 'cogs' }];
    const sem = basisFromBudget(items, {}, profile);
    expect(sem.missing).toContain('referenceRevenue');
    expect(computeTargets(sem, profile, {}).breakeven.status).toBe('missing');
    const com = basisFromBudget(items, { referenceRevenue: 15000 }, profile);
    expect(com.variableRate).toBeCloseTo(0.4);
    expect(computeTargets(com, profile, {}).breakeven.monthly!).toBeCloseTo(16666.67, 2);
  });

  it('mix de canais: soma 100% e taxa ponderada; mudar o mix muda a meta', () => {
    const items: BudgetItem[] = [budget[0], { id: '2', categoria: 'CMV', descricao: '', tipo: 'variable', valor: 30, unidade: 'pct', natureza: 'cogs' },
      { id: '4', categoria: 'Taxas delivery', descricao: '', tipo: 'variable', valor: 99, unidade: 'pct', natureza: 'fees' }];
    const g1: GoalsSettings = { useMix: true, mix: { counter: { share: 50, feePct: 0 }, doordash: { share: 50, feePct: 20 } } };
    const b1 = basisFromBudget(items, g1, profile);
    expect(b1.variableRate).toBeCloseTo(0.30 + 0.10); // taxa de delivery do orçamento é ignorada (sem dupla contagem)
    const g2: GoalsSettings = { useMix: true, mix: { counter: { share: 80, feePct: 0 }, doordash: { share: 20, feePct: 20 } } };
    const b2 = basisFromBudget(items, g2, profile);
    expect(b2.variableRate).toBeCloseTo(0.34);
    expect(computeTargets(b2, profile, g2).breakeven.monthly!).toBeLessThan(computeTargets(b1, profile, g1).breakeven.monthly!);
    const bad = basisFromBudget(items, { useMix: true, mix: { counter: { share: 70, feePct: 0 } } }, profile);
    expect(bad.missing).toContain('mixSum');
  });

  it('mês sem vendas informadas não calcula', () => {
    const m: FinanceMonth = { restaurantId: 'r', period: '2026-10', status: 'closed', estimateSnapshot: [], entries: [{ id: 'a', categoria: 'Aluguel', descricao: '', tipo: 'fixed', valor: 5000 }] };
    const b = basisFromMonth(m, {});
    expect(b.missing).toContain('sales');
    expect(computeTargets(b, profile, {}).breakeven.status).toBe('missing');
  });

  it('mês fechado: CMV consumido ou compras como aproximação; comissões separadas das vendas', () => {
    const m: FinanceMonth = {
      restaurantId: 'r', period: '2026-10', status: 'closed', estimateSnapshot: [],
      entries: [
        { id: 'a', categoria: 'Aluguel', descricao: '', tipo: 'fixed', valor: 10000 },
        { id: 'b', categoria: 'Ingredientes', descricao: '', tipo: 'variable', valor: 7000, natureza: 'cogs' },
        { id: 'c', categoria: 'DoorDash', descricao: 'Comissão', tipo: 'variable', valor: 1000, plataforma: 'doordash', natureza: 'fees' },
      ],
      sales: { channels: { counter: 15000, doordash: 5000 }, inventoryStart: 2000, inventoryEnd: 3000 },
    };
    const consumed = basisFromMonth(m, { cogsMode: 'consumed' });
    expect(consumed.variableRate).toBeCloseTo((6000 + 1000) / 20000); // 2000 + 7000 − 3000 = 6000
    const purchases = basisFromMonth(m, { cogsMode: 'purchases' });
    expect(purchases.variableRate).toBeCloseTo((7000 + 1000) / 20000);
    expect(purchases.assumptions).toContain('purchasesAsCogs');
    const noInv = basisFromMonth({ ...m, sales: { channels: m.sales!.channels } }, { cogsMode: 'consumed' });
    expect(noInv.missing).toContain('inventory');
  });

  it('remuneração do proprietário entra nos fixos quando marcada', () => {
    const b = basisFromBudget(budget, { includeOwnerPay: true, ownerPay: 2000 }, profile);
    expect(b.fixed).toBe(12000);
    expect(b.assumptions).toContain('ownerPay');
  });

  it('pedidos por canal com tickets diferentes', () => {
    const p: RestaurantProfile = { ticketByChannel: { counter: 20, doordash: 40 } };
    const g: GoalsSettings = { useMix: true, mix: { counter: { share: 50, feePct: 0 }, doordash: { share: 50, feePct: 20 } } };
    expect(ordersPerDay(1000, p, g)).toBe(Math.ceil(500 / 20 + 500 / 40)); // 25 + 12.5 → 38
  });
});
