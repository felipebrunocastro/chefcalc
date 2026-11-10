import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Save, Copy, RefreshCw, Lock, Unlock, Wallet, Info, Check, Truck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useRestaurant } from '../../hooks/useRestaurant';
import { getFinanceMonths, saveFinanceMonth } from '../../data/repo';
import { formatCurrency } from '../../lib/currency';
import {
  DELIVERY_PLATFORMS, SUGGESTED_BUDGET, actualTotals, budgetTotals, currentPeriod, deliveryTotals,
  formatPeriod, isEntered, monthState, varianceByCategory, type MonthState,
} from '../../utils/finance';
import type { BudgetItem, CostType, DeliveryPlatform, FinanceEntry, FinanceMonth } from '../../types';

const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const;

export function useFinanceMonths(restaurantId: string | undefined) {
  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!restaurantId) { setMonths([]); setLoading(false); return; }
    try { setMonths(await getFinanceMonths(restaurantId)); } catch { setMonths([]); }
    setLoading(false);
  }, [restaurantId]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  return { months, loading, reload: load };
}

export function StateBadge({ state }: { state: MonthState }) {
  const { t } = useTranslation();
  const map = {
    empty: ['bg-slate-100 text-slate-600', t('finance.stateEmpty')],
    inProgress: ['bg-amber-100 text-amber-800', t('finance.stateInProgress')],
    closed: ['bg-emerald-100 text-emerald-800', t('finance.stateClosed')],
  } as const;
  const [cls, label] = map[state];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function money(v: number) { return formatCurrency(v); }

function SignedDiff({ v }: { v: number }) {
  const cls = v > 0.004 ? 'text-red-700' : v < -0.004 ? 'text-emerald-700' : 'text-slate-600';
  return <span className={`font-mono ${cls}`}>{v > 0.004 ? '+' : ''}{money(v)}</span>;
}

export function FinancePage() {
  const { t, i18n } = useTranslation();
  const { current: restaurant, update } = useRestaurant();
  const locale = LOCALES[(i18n.language as keyof typeof LOCALES)] ?? 'pt-BR';
  const { months, reload } = useFinanceMonths(restaurant?.id);

  // ---- Orçamento de referência ----
  const [budget, setBudget] = useState<BudgetItem[]>(restaurant?.budget ?? []);
  const [budgetStatus, setBudgetStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEffect(() => { setBudget(restaurant?.budget ?? []); }, [restaurant?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const bt = budgetTotals(budget);

  const setBudgetItem = (id: string, patch: Partial<BudgetItem>) => setBudget(b => b.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const addBudgetLine = (tipo: CostType = 'fixed') => setBudget(b => [...b, { id: uuidv4(), categoria: '', descricao: '', tipo, valor: 0 }]);
  const addSuggested = () => setBudget(b => {
    const have = new Set(b.map(i => i.categoria.trim().toLowerCase()));
    const add = SUGGESTED_BUDGET
      .map(s => ({ id: uuidv4(), categoria: t(`finance.cat.${s.key}`), descricao: '', tipo: s.tipo, valor: 0 }))
      .filter(i => !have.has(i.categoria.toLowerCase()));
    return [...b, ...add];
  });
  const saveBudget = async () => {
    if (!restaurant) return;
    setBudgetStatus('saving');
    const clean = budget.map(i => ({ ...i, categoria: i.categoria.trim(), valor: Number(i.valor) || 0 }));
    await update(restaurant.id, { budget: clean });
    setBudgetStatus('saved');
    setTimeout(() => setBudgetStatus('idle'), 1500);
  };

  // ---- Mês real ----
  const [period, setPeriod] = useState(currentPeriod());
  const stored = months.find(m => m.period === period);
  const [draft, setDraft] = useState<FinanceMonth | null>(null);
  const [monthStatus, setMonthStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!restaurant) return;
    setDraft(stored
      ? structuredClone(stored)
      : { restaurantId: restaurant.id, period, status: 'open', estimateSnapshot: null, entries: [] });
  }, [restaurant?.id, period, stored]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedBudget = restaurant?.budget ?? [];
  const entries = draft?.entries ?? [];
  const general = entries.filter(e => !e.plataforma);
  const totals = actualTotals(entries);
  const delivery = deliveryTotals(entries);
  const snapshot = draft?.estimateSnapshot ?? null;
  const estimateForMonth = snapshot ?? savedBudget;
  const est = budgetTotals(estimateForMonth);
  const variance = varianceByCategory(estimateForMonth, entries);
  const state = monthState(draft ?? undefined);

  const patchEntries = (fn: (e: FinanceEntry[]) => FinanceEntry[]) => setDraft(d => (d ? { ...d, entries: fn(d.entries) } : d));
  const setEntry = (id: string, patch: Partial<FinanceEntry>) => patchEntries(es => es.map(e => (e.id === id ? { ...e, ...patch } : e)));
  const removeEntry = (id: string) => patchEntries(es => es.filter(e => e.id !== id));
  const addEntry = () => patchEntries(es => [...es, { id: uuidv4(), categoria: '', descricao: '', tipo: 'variable', valor: null }]);
  const addPlatformEntry = (p: DeliveryPlatform, descricao: string) => patchEntries(es => [
    ...es,
    { id: uuidv4(), categoria: DELIVERY_PLATFORMS.find(x => x.id === p)!.label, descricao, tipo: 'variable', valor: null, plataforma: p },
  ]);

  const copyBudget = () => setDraft(d => {
    if (!d) return d;
    const have = new Set(d.entries.map(e => `${e.categoria.trim().toLowerCase()}|${e.descricao.trim().toLowerCase()}`));
    const add: FinanceEntry[] = savedBudget
      .filter(b => !have.has(`${b.categoria.trim().toLowerCase()}|${b.descricao.trim().toLowerCase()}`))
      .map(b => ({ id: uuidv4(), categoria: b.categoria, descricao: b.descricao, tipo: b.tipo, valor: null }));
    return { ...d, estimateSnapshot: d.estimateSnapshot ?? structuredClone(savedBudget), entries: [...d.entries, ...add] };
  });

  const saveMonth = async (next?: FinanceMonth) => {
    const m = next ?? draft;
    if (!m) return;
    setMonthStatus('saving');
    // A estimativa do mês é congelada no primeiro salvamento.
    const toSave: FinanceMonth = {
      ...m,
      estimateSnapshot: m.estimateSnapshot ?? structuredClone(savedBudget),
      entries: m.entries.map(e => ({ ...e, categoria: e.categoria.trim() })),
    };
    await saveFinanceMonth(toSave);
    await reload();
    setMonthStatus('saved');
    setTimeout(() => setMonthStatus('idle'), 1500);
  };

  const periodOptions = useMemo(() => {
    const set = new Set(months.map(m => m.period));
    const now = new Date();
    for (let i = -1; i < 13; i++) set.add(currentPeriod(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    set.add(period);
    return [...set].sort().reverse();
  }, [months, period]);

  if (!restaurant || !draft) return null;

  const budgetCategories = [...new Set(savedBudget.map(b => b.categoria).filter(Boolean))];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Wallet size={24} className="text-blue-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-navy-900">{t('finance.title')}</h1>
        <span className="ml-auto text-xs font-medium text-slate-500 bg-white border border-blue-100 rounded-md px-2 py-1">{restaurant.currency}</span>
      </div>

      {/* ---------------- Tabela 1: estimativa ---------------- */}
      <section className="card p-4 md:p-5" aria-labelledby="budget-h">
        <div className="flex flex-wrap items-start gap-2 mb-3">
          <div className="flex-1 min-w-[14rem]">
            <h2 id="budget-h" className="font-semibold text-navy-900">{t('finance.budgetTitle')}</h2>
            <p className="text-xs text-slate-500">{t('finance.budgetHint')}</p>
          </div>
          <button onClick={addSuggested} className="btn-secondary"><Plus size={15} /> {t('finance.addSuggested')}</button>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-blue-100">
                <th className="py-2 px-2 font-medium">{t('finance.category')}</th>
                <th className="py-2 px-2 font-medium">{t('finance.description')}</th>
                <th className="py-2 px-2 font-medium w-32">{t('finance.type')}</th>
                <th className="py-2 px-2 font-medium w-36 text-right">{t('finance.value')}</th>
                <th className="w-10"><span className="sr-only">{t('finance.remove')}</span></th>
              </tr>
            </thead>
            <tbody>
              {budget.map(i => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="p-1"><input aria-label={t('finance.category')} value={i.categoria} onChange={e => setBudgetItem(i.id, { categoria: e.target.value })} className="field !py-1.5" /></td>
                  <td className="p-1"><input aria-label={t('finance.description')} value={i.descricao} onChange={e => setBudgetItem(i.id, { descricao: e.target.value })} className="field !py-1.5" /></td>
                  <td className="p-1">
                    <select aria-label={t('finance.type')} value={i.tipo} onChange={e => setBudgetItem(i.id, { tipo: e.target.value as CostType })} className="field !py-1.5">
                      <option value="fixed">{t('finance.fixed')}</option>
                      <option value="variable">{t('finance.variable')}</option>
                    </select>
                  </td>
                  <td className="p-1"><input aria-label={t('finance.value')} type="number" min="0" step="0.01" inputMode="decimal" value={i.valor} onChange={e => setBudgetItem(i.id, { valor: Number(e.target.value) })} className="field !py-1.5 text-right font-mono" /></td>
                  <td className="p-1 text-center"><button onClick={() => setBudget(b => b.filter(x => x.id !== i.id))} className="btn-ghost hover:!text-red-600" aria-label={t('finance.remove')}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={() => addBudgetLine()} className="btn-secondary"><Plus size={15} /> {t('finance.addLine')}</button>
          <button onClick={saveBudget} disabled={budgetStatus === 'saving'} className="btn-primary ml-auto">
            {budgetStatus === 'saved' ? <Check size={15} /> : <Save size={15} />}
            {budgetStatus === 'saving' ? t('finance.saving') : budgetStatus === 'saved' ? t('finance.saved') : t('finance.save')}
          </button>
        </div>

        <dl className="grid grid-cols-3 gap-2 mt-4 text-sm">
          <Stat label={t('finance.subtotalFixed')} value={money(bt.fixed)} />
          <Stat label={t('finance.subtotalVariable')} value={money(bt.variable)} />
          <Stat label={t('finance.total')} value={money(bt.total)} strong />
        </dl>
      </section>

      {/* ---------------- Tabela 2: real ---------------- */}
      <section className="card p-4 md:p-5" aria-labelledby="actual-h">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 id="actual-h" className="font-semibold text-navy-900 mr-2">{t('finance.actualTitle')}</h2>
          <label className="sr-only" htmlFor="fin-period">{t('finance.month')}</label>
          <select id="fin-period" value={period} onChange={e => setPeriod(e.target.value)} className="field !w-auto !py-1.5">
            {periodOptions.map(p => <option key={p} value={p}>{formatPeriod(p, locale)}</option>)}
          </select>
          <StateBadge state={state} />
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={copyBudget} disabled={savedBudget.length === 0} className="btn-secondary" title={t('finance.copyBudgetHint')}><Copy size={15} /> {t('finance.copyBudget')}</button>
            <button
              onClick={() => { const next = { ...draft, status: draft.status === 'closed' ? 'open' as const : 'closed' as const }; setDraft(next); saveMonth(next); }}
              className="btn-secondary"
            >
              {draft.status === 'closed' ? <><Unlock size={15} /> {t('finance.reopenMonth')}</> : <><Lock size={15} /> {t('finance.closeMonth')}</>}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">{t('finance.actualHint')}</p>

        {state !== 'closed' && (
          <p className="flex gap-2 items-start text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 mb-3" role="status">
            <Info size={14} className="shrink-0 mt-0.5" />
            {state === 'empty' ? t('finance.stateEmptyHint') : t('finance.stateInProgressHint')}
          </p>
        )}

        <datalist id="budget-cats">{budgetCategories.map(c => <option key={c} value={c} />)}</datalist>
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-blue-100">
                <th className="py-2 px-2 font-medium">{t('finance.category')}</th>
                <th className="py-2 px-2 font-medium">{t('finance.description')}</th>
                <th className="py-2 px-2 font-medium w-32">{t('finance.type')}</th>
                <th className="py-2 px-2 font-medium w-36 text-right">{t('finance.amount')}</th>
                <th className="w-10"><span className="sr-only">{t('finance.remove')}</span></th>
              </tr>
            </thead>
            <tbody>
              {general.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-slate-400">{t('finance.noEntries')}</td></tr>
              )}
              {general.map(e => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="p-1"><input list="budget-cats" aria-label={t('finance.category')} value={e.categoria} onChange={ev => setEntry(e.id, { categoria: ev.target.value })} className="field !py-1.5" /></td>
                  <td className="p-1"><input aria-label={t('finance.description')} value={e.descricao} onChange={ev => setEntry(e.id, { descricao: ev.target.value })} className="field !py-1.5" /></td>
                  <td className="p-1">
                    <select aria-label={t('finance.type')} value={e.tipo} onChange={ev => setEntry(e.id, { tipo: ev.target.value as CostType })} className="field !py-1.5">
                      <option value="fixed">{t('finance.fixed')}</option>
                      <option value="variable">{t('finance.variable')}</option>
                    </select>
                  </td>
                  <td className="p-1"><AmountInput entry={e} onChange={v => setEntry(e.id, { valor: v })} /></td>
                  <td className="p-1 text-center"><button onClick={() => removeEntry(e.id)} className="btn-ghost hover:!text-red-600" aria-label={t('finance.remove')}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addEntry} className="btn-secondary mt-3"><Plus size={15} /> {t('finance.addEntry')}</button>

        {/* Delivery */}
        <div className="mt-6">
          <h3 className="font-semibold text-navy-900 flex items-center gap-2"><Truck size={16} className="text-blue-600" aria-hidden="true" /> {t('finance.delivery')}</h3>
          <p className="text-xs text-slate-500 mb-3">{t('finance.deliveryHint')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {DELIVERY_PLATFORMS.map(p => {
              const items = entries.filter(e => e.plataforma === p.id);
              return (
                <div key={p.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-navy-900">{p.label}</span>
                    <span className="text-xs text-slate-500">{t('finance.subtotal')}: <b className="font-mono text-navy-900">{money(delivery[p.id])}</b></span>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map(e => (
                      <li key={e.id} className="flex gap-1.5">
                        <input aria-label={`${p.label} — ${t('finance.description')}`} value={e.descricao} onChange={ev => setEntry(e.id, { descricao: ev.target.value })} className="field !py-1.5 flex-1 min-w-0" />
                        <div className="w-28"><AmountInput entry={e} onChange={v => setEntry(e.id, { valor: v })} /></div>
                        <button onClick={() => removeEntry(e.id)} className="btn-ghost hover:!text-red-600" aria-label={t('finance.remove')}><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={() => addPlatformEntry(p.id, t('finance.commission'))} className="btn-secondary !px-2 !py-1 text-xs"><Plus size={13} /> {t('finance.commission')}</button>
                    <button onClick={() => addPlatformEntry(p.id, t('finance.fee'))} className="btn-secondary !px-2 !py-1 text-xs"><Plus size={13} /> {t('finance.fee')}</button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-sm mt-2 text-right">{t('finance.deliveryTotal')}: <b className="font-mono text-navy-900">{money(delivery.total)}</b></p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <dl className="grid grid-cols-3 gap-2 text-sm flex-1 min-w-[18rem]">
            <Stat label={t('finance.realFixed')} value={money(totals.fixed)} />
            <Stat label={t('finance.realVariable')} value={money(totals.variable)} />
            <Stat label={t('finance.realTotal')} value={money(totals.total)} strong />
          </dl>
          <button onClick={() => saveMonth()} disabled={monthStatus === 'saving'} className="btn-primary">
            {monthStatus === 'saved' ? <Check size={15} /> : <Save size={15} />}
            {monthStatus === 'saving' ? t('finance.saving') : monthStatus === 'saved' ? t('finance.saved') : t('finance.save')}
          </button>
        </div>
      </section>

      {/* ---------------- Estimado x real ---------------- */}
      <section className="card p-4 md:p-5" aria-labelledby="var-h">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 id="var-h" className="font-semibold text-navy-900">{t('finance.variance')} — <span>{formatPeriod(period, locale)}</span></h2>
          <StateBadge state={state} />
        </div>
        <p className="text-xs text-slate-500 mb-1">{t('finance.varianceHint')}</p>
        <p className="text-xs text-slate-500 mb-3 flex flex-wrap items-center gap-2">
          {snapshot ? `${t('finance.snapshotTitle')}: ${money(est.total)}. ${t('finance.snapshotHint')}` : t('finance.noSnapshot')}
          <button onClick={() => setDraft(d => (d ? { ...d, estimateSnapshot: structuredClone(savedBudget) } : d))} className="text-blue-700 hover:underline inline-flex items-center gap-1">
            <RefreshCw size={12} /> {t('finance.refreshSnapshot')}
          </button>
        </p>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-blue-100">
                <th className="py-2 px-2 font-medium">{t('finance.category')}</th>
                <th className="py-2 px-2 font-medium text-right">{t('finance.estimated')}</th>
                <th className="py-2 px-2 font-medium text-right">{t('finance.actual')}</th>
                <th className="py-2 px-2 font-medium text-right">{t('finance.difference')}</th>
              </tr>
            </thead>
            <tbody>
              {variance.map(v => (
                <tr key={v.categoria} className="border-b border-slate-100">
                  <td className="py-1.5 px-2">{v.categoria}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{money(v.estimado)}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{v.temReal ? money(v.real) : <span className="text-slate-400 italic">{t('finance.pending')}</span>}</td>
                  <td className="py-1.5 px-2 text-right">{v.temReal ? <SignedDiff v={v.diferenca} /> : <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 px-2">{t('finance.total')}</td>
                <td className="py-2 px-2 text-right font-mono">{money(est.total)}</td>
                <td className="py-2 px-2 text-right font-mono">{state === 'empty' ? <span className="text-slate-400 italic">{t('finance.pending')}</span> : money(totals.total)}</td>
                <td className="py-2 px-2 text-right">{state === 'empty' ? '—' : <SignedDiff v={totals.total - est.total} />}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ---------------- Histórico ---------------- */}
      <section className="card p-4 md:p-5" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-semibold text-navy-900 mb-3">{t('finance.history')}</h2>
        {months.length === 0 ? (
          <p className="text-sm text-slate-400">{t('finance.noHistory')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {months.map(m => {
              const tt = actualTotals(m.entries);
              const e = budgetTotals(m.estimateSnapshot ?? []);
              const s = monthState(m);
              return (
                <li key={m.period}>
                  <button onClick={() => setPeriod(m.period)} aria-current={m.period === period ? 'true' : undefined}
                    className={`w-full flex flex-wrap items-center gap-3 py-2.5 px-2 rounded-lg text-left text-sm hover:bg-blue-50 ${m.period === period ? 'bg-blue-50' : ''}`}>
                    <span className="font-medium text-navy-900 w-40">{formatPeriod(m.period, locale)}</span>
                    <StateBadge state={s} />
                    <span className="ml-auto text-slate-500">{t('finance.estimated')}: <span className="font-mono">{money(e.total)}</span></span>
                    <span className="text-slate-700">{t('finance.actual')}: <span className="font-mono">{m.entries.some(isEntered) ? money(tt.total) : '—'}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function AmountInput({ entry, onChange }: { entry: FinanceEntry; onChange: (v: number | null) => void }) {
  const { t } = useTranslation();
  return (
    <input
      type="number" step="0.01" inputMode="decimal"
      aria-label={t('finance.amount')}
      placeholder={t('finance.pending')}
      value={entry.valor ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="field !py-1.5 text-right font-mono placeholder:italic placeholder:text-slate-400"
    />
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${strong ? 'bg-navy-900 text-white' : 'bg-blue-50 text-navy-900'}`}>
      <dt className={`text-xs ${strong ? 'text-blue-200' : 'text-slate-500'}`}>{label}</dt>
      <dd className="font-mono font-semibold">{value}</dd>
    </div>
  );
}
