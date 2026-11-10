import type { BudgetItem, FinanceEntry, FinanceMonth, DeliveryPlatform, CostType } from '../types';

export const DELIVERY_PLATFORMS: { id: DeliveryPlatform; label: string }[] = [
  { id: 'doordash', label: 'DoorDash' },
  { id: 'ubereats', label: 'Uber Eats' },
  { id: 'grubhub', label: 'Grubhub' },
];

// Categorias sugeridas (chaves i18n em finance.cat.*).
export const SUGGESTED_BUDGET: { key: string; tipo: CostType }[] = [
  { key: 'rent', tipo: 'fixed' },
  { key: 'insurance', tipo: 'fixed' },
  { key: 'internet', tipo: 'fixed' },
  { key: 'subscriptions', tipo: 'fixed' },
  { key: 'ingredients', tipo: 'variable' },
  { key: 'packaging', tipo: 'variable' },
  { key: 'energy', tipo: 'variable' },
  { key: 'maintenance', tipo: 'variable' },
  { key: 'deliveryFees', tipo: 'variable' },
];

export interface Totals { fixed: number; variable: number; total: number }

const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function budgetTotals(items: BudgetItem[]): Totals {
  let fixed = 0, variable = 0;
  for (const i of items) {
    if (i.tipo === 'fixed') fixed += num(i.valor); else variable += num(i.valor);
  }
  return { fixed, variable, total: fixed + variable };
}

// Lançamento conta apenas se tiver valor informado (null/vazio = pendente).
export const isEntered = (e: FinanceEntry) => typeof e.valor === 'number' && Number.isFinite(e.valor);

export function actualTotals(entries: FinanceEntry[]): Totals {
  let fixed = 0, variable = 0;
  for (const e of entries) {
    if (!isEntered(e)) continue;
    if (e.tipo === 'fixed') fixed += e.valor as number; else variable += e.valor as number;
  }
  return { fixed, variable, total: fixed + variable };
}

// Soma por plataforma somente os itens lançados (comissão, taxa...). Não existe
// campo "total da plataforma": o total é sempre derivado, evitando contar duas vezes.
export function deliveryTotals(entries: FinanceEntry[]): Record<DeliveryPlatform, number> & { total: number } {
  const out = { doordash: 0, ubereats: 0, grubhub: 0, total: 0 };
  for (const e of entries) {
    if (!e.plataforma || !isEntered(e)) continue;
    out[e.plataforma] += e.valor as number;
    out.total += e.valor as number;
  }
  return out;
}

export interface CategoryVariance { categoria: string; estimado: number; real: number; diferenca: number; temReal: boolean }

const norm = (s: string) => s.trim().toLowerCase();

// Diferença real − estimado por categoria (positivo = gastou mais que o previsto).
export function varianceByCategory(snapshot: BudgetItem[], entries: FinanceEntry[]): CategoryVariance[] {
  const map = new Map<string, CategoryVariance>();
  const get = (cat: string) => {
    const k = norm(cat) || '—';
    if (!map.has(k)) map.set(k, { categoria: cat.trim() || '—', estimado: 0, real: 0, diferenca: 0, temReal: false });
    return map.get(k)!;
  };
  for (const b of snapshot) get(b.categoria).estimado += num(b.valor);
  for (const e of entries) {
    if (!isEntered(e)) continue;
    const row = get(e.categoria);
    row.real += e.valor as number;
    row.temReal = true;
  }
  return [...map.values()].map(r => ({ ...r, diferenca: r.real - r.estimado }));
}

export type MonthState = 'empty' | 'inProgress' | 'closed';

// Sem lançamentos ou em andamento não devem parecer "custo zero" ou economia.
export function monthState(m: FinanceMonth | undefined): MonthState {
  if (!m || !m.entries.some(isEntered)) return 'empty';
  return m.status === 'closed' ? 'closed' : 'inProgress';
}

export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatPeriod(period: string, locale: string): string {
  const [y, m] = period.split('-').map(Number);
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
