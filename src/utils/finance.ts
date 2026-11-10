import type { BudgetItem, FinanceEntry, FinanceMonth, DeliveryPlatform, CostType, VariableKind } from '../types';

export const DELIVERY_PLATFORMS: { id: DeliveryPlatform; label: string }[] = [
  { id: 'doordash', label: 'DoorDash' },
  { id: 'ubereats', label: 'Uber Eats' },
  { id: 'grubhub', label: 'Grubhub' },
];

// Categorias sugeridas (chaves i18n em finance.cat.*).
export const SUGGESTED_BUDGET: { key: string; tipo: CostType; natureza?: VariableKind }[] = [
  { key: 'rent', tipo: 'fixed' },
  { key: 'payroll', tipo: 'fixed' },
  { key: 'insurance', tipo: 'fixed' },
  { key: 'internet', tipo: 'fixed' },
  { key: 'subscriptions', tipo: 'fixed' },
  { key: 'ingredients', tipo: 'variable', natureza: 'cogs' },
  { key: 'packaging', tipo: 'variable', natureza: 'packaging' },
  { key: 'variableLabor', tipo: 'variable', natureza: 'labor' },
  { key: 'energy', tipo: 'mixed', natureza: 'other' },
  { key: 'maintenance', tipo: 'variable', natureza: 'other' },
  { key: 'deliveryFees', tipo: 'variable', natureza: 'fees' },
];

export const VARIABLE_KINDS: VariableKind[] = ['cogs', 'packaging', 'labor', 'fees', 'other'];

// Parte fixa e parte variável (em dinheiro) de um item. Itens variáveis em % não têm valor em dinheiro.
export function splitItem(i: { tipo: CostType; valor: number | null; parteFixa?: number; unidade?: 'money' | 'pct' }): { fixed: number; variable: number; pct: number } {
  const v = typeof i.valor === 'number' && Number.isFinite(i.valor) ? i.valor : 0;
  if (i.tipo === 'fixed') return { fixed: v, variable: 0, pct: 0 };
  if (i.tipo === 'mixed') {
    const f = Math.min(Math.max(i.parteFixa ?? 0, 0), v);
    return { fixed: f, variable: v - f, pct: 0 };
  }
  if (i.unidade === 'pct') return { fixed: 0, variable: 0, pct: v };
  return { fixed: 0, variable: v, pct: 0 };
}

export interface Totals { fixed: number; variable: number; total: number; variablePct?: number }


export function budgetTotals(items: BudgetItem[]): Totals {
  let fixed = 0, variable = 0, variablePct = 0;
  for (const i of items) {
    const p = splitItem(i);
    fixed += p.fixed; variable += p.variable; variablePct += p.pct;
  }
  return { fixed, variable, total: fixed + variable, variablePct };
}

// Lançamento conta apenas se tiver valor informado (null/vazio = pendente).
export const isEntered = (e: FinanceEntry) => typeof e.valor === 'number' && Number.isFinite(e.valor);

export function actualTotals(entries: FinanceEntry[]): Totals {
  let fixed = 0, variable = 0;
  for (const e of entries) {
    if (!isEntered(e)) continue;
    const p = splitItem({ ...e, unidade: 'money' });
    fixed += p.fixed; variable += p.variable;
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
  for (const b of snapshot) { const p = splitItem(b); get(b.categoria).estimado += p.fixed + p.variable; }
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

// Soma das vendas líquidas lançadas no mês (null = canal não informado).
export function monthSalesTotal(m: FinanceMonth | undefined): { total: number; informed: boolean } {
  const ch = m?.sales?.channels ?? {};
  let total = 0, informed = false;
  for (const v of Object.values(ch)) {
    if (typeof v === 'number' && Number.isFinite(v)) { total += v; informed = true; }
  }
  return { total, informed };
}
