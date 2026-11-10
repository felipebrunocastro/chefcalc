import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, ArrowRight, Info, AlertTriangle } from 'lucide-react';
import { basisFromBudget, computeTargets } from '../../utils/breakeven';
import { CURRENCIES, type Currency } from '../../lib/currency';
import type { BudgetItem } from '../../types';

export interface SimValues { fixed: number; variablePct: number; marginPct: number; days: number | null; ticket: number | null; currency: Currency }
export const SIM_EXAMPLE: SimValues = { fixed: 10000, variablePct: 40, marginPct: 8, days: null, ticket: null, currency: 'USD' };
export const PENDING_SIM_KEY = 'chefcalc:pendingSim';
const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const;

// Mesma lógica do Financeiro (utils/breakeven).
export function simulate(v: SimValues) {
  const budget: BudgetItem[] = [
    { id: 'f', categoria: 'fixed', descricao: '', tipo: 'fixed', valor: v.fixed || 0 },
    { id: 'v', categoria: 'variable', descricao: '', tipo: 'variable', valor: v.variablePct || 0, unidade: 'pct' },
  ];
  const profile = { openDaysPerMonth: v.days, avgTicket: v.ticket };
  const r = computeTargets(basisFromBudget(budget, {}, profile), profile, {});
  return { breakeven: r.breakeven, target: r.byMargin(v.marginPct || 0), cm: r.contributionMargin };
}

export function Simulator({ onApply }: { onApply: (v: SimValues) => void }) {
  const { t, i18n } = useTranslation();
  const [v, setV] = useState<SimValues>(SIM_EXAMPLE);
  const locale = LOCALES[(i18n.language as keyof typeof LOCALES)] ?? 'pt-BR';
  const money = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency: v.currency }), [locale, v.currency]);
  const res = simulate(v);
  const set = (k: keyof SimValues, raw: string) => setV(x => ({ ...x, [k]: raw === '' ? (k === 'days' || k === 'ticket' ? null : 0) : Number(raw) }));

  const Result = ({ label, r, testid }: { label: string; r: typeof res.breakeven; testid: string }) => (
    <div className="rounded-2xl bg-white border border-blue-100 p-5 shadow-sm flex-1 min-w-0" data-testid={testid} aria-live="polite">
      <div className="text-sm text-slate-600">{label}</div>
      {r.status === 'ok' ? (
        <>
          <div className="text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight mt-1 break-words">{money.format(r.monthly!)}</div>
          <div className="text-sm text-slate-600 mt-2 space-y-0.5">
            {r.daily !== undefined && <div>{t('landing.sim.perDay', { v: money.format(r.daily) })}</div>}
            {r.ordersPerDay !== undefined && <div>{t('landing.sim.orders', { n: r.ordersPerDay })}</div>}
          </div>
        </>
      ) : (
        <div className="text-base font-semibold text-red-700 mt-2 flex gap-2"><AlertTriangle size={18} className="shrink-0 mt-0.5" />{r.status === 'noBreakeven' ? t('landing.sim.noBreakeven') : '—'}</div>
      )}
    </div>
  );

  const field = (k: keyof SimValues, label: string, opts: { step?: string; suffix?: string; optional?: boolean } = {}) => (
    <div>
      <label htmlFor={`sim-${k}`} className="block text-xs font-medium text-slate-600 mb-1">{label}{opts.optional && <span className="text-slate-400"> ({t('landing.sim.optional')})</span>}</label>
      <div className="relative">
        <input id={`sim-${k}`} type="number" inputMode="decimal" min="0" step={opts.step ?? '1'} value={(v[k] as number | null) ?? ''} onChange={e => set(k, e.target.value)}
          className="field !py-2.5 text-base font-semibold pr-10" />
        {opts.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{opts.suffix}</span>}
      </div>
    </div>
  );

  const cmPct = res.cm === null ? null : res.cm * 100;
  return (
    <div className="grid lg:grid-cols-[22rem_1fr] gap-6">
      <div className="rounded-2xl bg-white border border-blue-100 p-5 shadow-sm space-y-4">
        {field('fixed', t('landing.sim.fixed'), { step: '100' })}
        {field('variablePct', t('landing.sim.variable'), { step: '0.5', suffix: '%' })}
        {field('marginPct', t('landing.sim.margin'), { step: '0.5', suffix: '%' })}
        <div className="grid grid-cols-2 gap-3">
          {field('days', t('landing.sim.days'), { optional: true })}
          {field('ticket', t('landing.sim.ticket'), { step: '0.5', optional: true })}
        </div>
        <div>
          <label htmlFor="sim-currency" className="block text-xs font-medium text-slate-600 mb-1">{t('landing.sim.currency')}</label>
          <select id="sim-currency" value={v.currency} onChange={e => setV(x => ({ ...x, currency: e.target.value as Currency }))} className="field">
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
          </select>
        </div>
        <button onClick={() => setV(SIM_EXAMPLE)} className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"><RotateCcw size={14} /> {t('landing.sim.reset')}</button>
      </div>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Result label={t('landing.sim.breakeven')} r={res.breakeven} testid="sim-breakeven" />
          <Result label={t('landing.sim.target', { pct: v.marginPct })} r={res.target.status === 'infeasible' ? { status: 'missing' } : res.target} testid="sim-target" />
        </div>
        {res.target.status === 'infeasible' && (
          <p className="rounded-xl bg-red-50 border border-red-200 text-red-900 px-4 py-3 text-sm flex gap-2" role="alert" data-testid="sim-infeasible">
            <AlertTriangle size={18} className="shrink-0" />
            {t('landing.sim.infeasible', { v: v.variablePct, cm: cmPct === null ? '—' : +cmPct.toFixed(2), m: cmPct === null ? '—' : +cmPct.toFixed(2) })}
          </p>
        )}
        <p className="text-sm text-slate-700 flex gap-2"><Info size={16} className="shrink-0 mt-0.5 text-blue-600" /> {t('landing.sim.difference', { pct: v.marginPct })}</p>
        <p className="text-xs text-slate-500">{t('landing.sim.formula')}</p>
        <button onClick={() => onApply(v)} className="btn-primary !px-6 !py-3 text-base">{t('landing.sim.apply')} <ArrowRight size={18} /></button>
      </div>
    </div>
  );
}
