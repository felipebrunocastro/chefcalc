import { describe, it, expect } from 'vitest';
import { actualTotals, budgetTotals, deliveryTotals, monthState, varianceByCategory } from '../utils/finance';
import type { BudgetItem, FinanceEntry, FinanceMonth } from '../types';

const budget: BudgetItem[] = [
  { id: '1', categoria: 'Aluguel', descricao: '', tipo: 'fixed', valor: 3000 },
  { id: '2', categoria: 'Internet', descricao: '', tipo: 'fixed', valor: 100 },
  { id: '3', categoria: 'Ingredientes', descricao: '', tipo: 'variable', valor: 5000 },
];

const entries: FinanceEntry[] = [
  { id: 'a', categoria: 'Aluguel', descricao: '', tipo: 'fixed', valor: 3000 },
  { id: 'b', categoria: 'Ingredientes', descricao: 'Sysco', tipo: 'variable', valor: 3500 },
  { id: 'c', categoria: 'ingredientes ', descricao: 'Feira', tipo: 'variable', valor: 2000 },
  { id: 'd', categoria: 'Internet', descricao: '', tipo: 'fixed', valor: null }, // pendente
  { id: 'e', categoria: 'DoorDash', descricao: 'Comissão', tipo: 'variable', valor: 420.5, plataforma: 'doordash' },
  { id: 'f', categoria: 'DoorDash', descricao: 'Taxa', tipo: 'variable', valor: 30, plataforma: 'doordash' },
  { id: 'g', categoria: 'Uber Eats', descricao: 'Comissão', tipo: 'variable', valor: 310, plataforma: 'ubereats' },
  { id: 'h', categoria: 'Grubhub', descricao: 'Comissão', tipo: 'variable', valor: 99.5, plataforma: 'grubhub' },
  { id: 'i', categoria: 'Grubhub', descricao: 'Taxa', tipo: 'variable', valor: null, plataforma: 'grubhub' },
];

describe('finance', () => {
  it('subtotais do orçamento', () => {
    expect(budgetTotals(budget)).toEqual({ fixed: 3100, variable: 5000, total: 8100 });
  });

  it('reais somam só o que foi lançado (pendente não vira zero contado)', () => {
    const t = actualTotals(entries);
    expect(t.fixed).toBe(3000);
    expect(t.variable).toBeCloseTo(3500 + 2000 + 420.5 + 30 + 310 + 99.5);
  });

  it('delivery: subtotal por plataforma e total', () => {
    const d = deliveryTotals(entries);
    expect(d.doordash).toBeCloseTo(450.5);
    expect(d.ubereats).toBeCloseTo(310);
    expect(d.grubhub).toBeCloseTo(99.5);
    expect(d.total).toBeCloseTo(860);
  });

  it('diferença estimado x real por categoria, agrupando várias linhas', () => {
    const v = varianceByCategory(budget, entries);
    const ing = v.find(x => x.categoria === 'Ingredientes')!;
    expect(ing.real).toBe(5500);
    expect(ing.diferenca).toBe(500);
    const net = v.find(x => x.categoria === 'Internet')!;
    expect(net.temReal).toBe(false); // pendente, não aparece como economia
  });

  it('estado do mês', () => {
    const base: FinanceMonth = { restaurantId: 'r', period: '2026-10', status: 'open', estimateSnapshot: budget, entries: [] };
    expect(monthState(undefined)).toBe('empty');
    expect(monthState(base)).toBe('empty');
    expect(monthState({ ...base, entries: [entries[3]] })).toBe('empty');
    expect(monthState({ ...base, entries })).toBe('inProgress');
    expect(monthState({ ...base, entries, status: 'closed' })).toBe('closed');
  });

  it('snapshot do mês não muda quando o orçamento muda', () => {
    const m: FinanceMonth = { restaurantId: 'r', period: '2026-09', status: 'closed', estimateSnapshot: structuredClone(budget), entries };
    budget[0].valor = 9999; // orçamento editado depois
    expect(budgetTotals(m.estimateSnapshot!).total).toBe(8100);
    budget[0].valor = 3000;
  });
});
