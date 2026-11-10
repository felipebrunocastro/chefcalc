import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, Save, Check, AlertTriangle, Info, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useRestaurant } from '../../hooks/useRestaurant';
import { formatCurrency } from '../../lib/currency';
import { formatPeriod } from '../../utils/finance';
import {
  basisFromBudget, basisFromMonth, computeTargets, salesChannels, NRA_REFERENCE, DEFAULT_SCENARIOS, type TargetResult,
} from '../../utils/breakeven';
import type { FinanceMonth, GoalsSettings } from '../../types';

const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const;
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

export function GoalsSection({ months }: { months: FinanceMonth[] }) {
  const { t, i18n } = useTranslation();
  const { current: restaurant, update } = useRestaurant();
  const locale = LOCALES[(i18n.language as keyof typeof LOCALES)] ?? 'pt-BR';
  const [g, setG] = useState<GoalsSettings>(() => structuredClone(restaurant?.goals ?? {}));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEffect(() => { setG(structuredClone(restaurant?.goals ?? {})); }, [restaurant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const closed = useMemo(() => months.filter(m => m.status === 'closed'), [months]);
  const profile = restaurant?.profile ?? {};
  const channels = salesChannels(profile);
  const basisKind = g.basis ?? 'budget';
  const month = months.find(m => m.period === (g.basisPeriod ?? closed[0]?.period));
  const basis = basisKind === 'budget'
    ? basisFromBudget(restaurant?.budget ?? [], g, profile)
    : basisFromMonth(month, g);
  const results = computeTargets(basis, profile, g);
  const scenarios = g.scenarios?.length ? g.scenarios : DEFAULT_SCENARIOS;
  const mixSum = channels.reduce((a, c) => a + (g.mix?.[c.id]?.share ?? 0), 0);
  const set = <K extends keyof GoalsSettings>(k: K, v: GoalsSettings[K]) => setG(x => ({ ...x, [k]: v }));

  if (!restaurant) return null;
  const label = (c: { id: string; name?: string }) => c.name || t(`channels.${c.id}`);
  const segment = profile.serviceSegment;

  const save = async () => {
    setStatus('saving');
    await update(restaurant.id, { goals: { ...g, scenarios } });
    setStatus('saved'); setTimeout(() => setStatus('idle'), 1500);
  };

  const rows: { key: string; label: string; r: TargetResult; pct?: number }[] = [
    { key: 'be', label: t('goals.breakeven'), r: results.breakeven },
    ...scenarios.map((pct, i) => ({ key: `s${i}`, label: t('goals.scenario', { pct }), r: results.byMargin(pct), pct })),
    ...(typeof g.customPct === 'number' ? [{ key: 'cp', label: `${t('goals.customPct')}: ${g.customPct}%`, r: results.byMargin(g.customPct), pct: g.customPct }] : []),
    ...(typeof g.customProfit === 'number' ? [{ key: 'cv', label: `${t('goals.customProfit')}: ${formatCurrency(g.customProfit)}`, r: results.byProfit(g.customProfit) }] : []),
  ];

  const cell = (r: TargetResult, k: 'monthly' | 'daily' | 'ordersPerDay') => {
    if (r.status === 'infeasible') return k === 'monthly' ? <span className="text-red-700 font-medium">{t('goals.infeasible')}</span> : '—';
    if (r.status === 'noBreakeven') return k === 'monthly' ? <span className="text-red-700 font-medium">{t('goals.noBreakeven')}</span> : '—';
    if (r.status === 'missing') return <span className="text-slate-400">—</span>;
    const v = r[k];
    if (v === undefined) return <span className="text-slate-400 text-xs italic">{k === 'daily' ? t('goals.needDays') : t('goals.needTicket')}</span>;
    return <span className="font-mono">{k === 'ordersPerDay' ? v : formatCurrency(v)}</span>;
  };

  return (
    <section className="card p-4 md:p-5 space-y-4" aria-labelledby="goals-h">
      <div className="flex flex-wrap items-center gap-2">
        <Target size={18} className="text-blue-600" aria-hidden="true" />
        <h2 id="goals-h" className="font-semibold text-navy-900">{t('goals.title')}</h2>
        <button onClick={save} disabled={status === 'saving'} className="btn-primary ml-auto">
          {status === 'saved' ? <Check size={15} /> : <Save size={15} />} {status === 'saved' ? t('goals.saved') : t('goals.save')}
        </button>
      </div>

      {/* Base */}
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="label">{t('goals.basis')}</legend>
        {(['budget', 'month'] as const).map(b => (
          <button key={b} onClick={() => set('basis', b)} aria-pressed={basisKind === b}
            className={`px-3 py-1.5 rounded-lg text-sm border ${basisKind === b ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold' : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50'}`}>
            {t(b === 'budget' ? 'goals.basisBudget' : 'goals.basisMonth')}
          </button>
        ))}
        {basisKind === 'month' && (closed.length ? (
          <select aria-label={t('finance.month')} value={g.basisPeriod ?? closed[0].period} onChange={e => set('basisPeriod', e.target.value)} className="field !w-auto !py-1.5">
            {closed.map(m => <option key={m.period} value={m.period}>{formatPeriod(m.period, locale)}</option>)}
          </select>
        ) : <span className="text-sm text-amber-800">{t('goals.noClosedMonths')}</span>)}
      </fieldset>
      <p className="text-xs font-medium text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        {basisKind === 'budget' ? t('goals.sourceBudget') : t('goals.sourceMonth', { month: month ? formatPeriod(month.period, locale) : '—' })}
      </p>

      {/* Parâmetros */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={!!g.includeOwnerPay} onChange={e => set('includeOwnerPay', e.target.checked)} className="accent-blue-600 w-4 h-4 mt-0.5" />
            {t('goals.ownerPay')}
          </label>
          {g.includeOwnerPay && (
            <input aria-label={t('goals.ownerPayValue')} placeholder={t('goals.ownerPayValue')} type="number" min="0" step="0.01" value={g.ownerPay ?? ''} onChange={e => set('ownerPay', numOrNull(e.target.value))} className="field !py-1.5 max-w-xs" />
          )}
        </div>
        {basisKind === 'month' ? (
          <fieldset>
            <legend className="label">{t('goals.cogsMode')}</legend>
            {(['consumed', 'purchases'] as const).map(m => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="radio" name="cogs" checked={(g.cogsMode ?? 'consumed') === m} onChange={() => set('cogsMode', m)} className="accent-blue-600" />
                {t(m === 'consumed' ? 'goals.cogsConsumed' : 'goals.cogsPurchases')}
              </label>
            ))}
          </fieldset>
        ) : (
          <div>
            <label className="label" htmlFor="ref-rev">{t('goals.referenceRevenue')}</label>
            <input id="ref-rev" type="number" min="0" step="0.01" value={g.referenceRevenue ?? ''} onChange={e => set('referenceRevenue', numOrNull(e.target.value))} className="field !py-1.5 max-w-xs" />
            <p className="text-xs text-slate-500 mt-1">{t('goals.referenceRevenueHint')}</p>
          </div>
        )}
      </div>

      {basisKind === 'budget' && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-navy-900">
            <input type="checkbox" checked={!!g.useMix} onChange={e => set('useMix', e.target.checked)} className="accent-blue-600 w-4 h-4" /> {t('goals.useMix')}
          </label>
          {g.useMix && (
            <div className="overflow-x-auto mt-2">
              <table className="text-sm min-w-[420px]">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-3 font-medium">{t('goals.channel')}</th><th className="py-1 pr-3 font-medium">{t('goals.share')}</th><th className="py-1 font-medium">{t('goals.fee')}</th></tr></thead>
                <tbody>
                  {channels.map(c => (
                    <tr key={c.id}>
                      <td className="py-1 pr-3">{label(c)}</td>
                      <td className="py-1 pr-3"><input aria-label={`${label(c)} — ${t('goals.share')}`} type="number" min="0" max="100" step="0.1" value={g.mix?.[c.id]?.share ?? ''} onChange={e => set('mix', { ...(g.mix ?? {}), [c.id]: { share: numOrNull(e.target.value), feePct: g.mix?.[c.id]?.feePct ?? null } })} className="field !py-1 w-24 text-right" /></td>
                      <td className="py-1"><input aria-label={`${label(c)} — ${t('goals.fee')}`} type="number" min="0" max="100" step="0.1" placeholder={c.feePct != null ? String(c.feePct) : '0'} value={g.mix?.[c.id]?.feePct ?? ''} onChange={e => set('mix', { ...(g.mix ?? {}), [c.id]: { share: g.mix?.[c.id]?.share ?? null, feePct: numOrNull(e.target.value) } })} className="field !py-1 w-24 text-right" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={`text-xs mt-1 ${Math.abs(mixSum - 100) < 0.01 ? 'text-emerald-700' : 'text-red-700'}`}>
                {t('goals.mixSum', { sum: +mixSum.toFixed(2) })}{Math.abs(mixSum - 100) >= 0.01 && ` — ${t('goals.mixMustBe100')}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Faltando / premissas */}
      {basis.missing.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm" role="status">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={15} /> {t('goals.missingTitle')}</p>
          <ul className="list-disc ml-5 text-xs mt-1">{[...new Set(basis.missing)].map(m => <li key={m}>{t(`goals.missing.${m}`)}</li>)}</ul>
        </div>
      )}

      {/* Indicadores */}
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl px-3 py-2 bg-blue-50"><dt className="text-xs text-slate-500">{t('goals.fixedCosts')}</dt><dd className="font-mono font-semibold text-navy-900">{formatCurrency(basis.fixed)}</dd></div>
        <div className="rounded-xl px-3 py-2 bg-blue-50"><dt className="text-xs text-slate-500">{t('goals.variableRate')}</dt><dd className="font-mono font-semibold text-navy-900">{basis.variableRate === null ? '—' : `${(basis.variableRate * 100).toFixed(1)}%`}</dd></div>
        <div className="rounded-xl px-3 py-2 bg-navy-900 text-white"><dt className="text-xs text-blue-200">{t('goals.cm')}</dt><dd className="font-mono font-semibold">{results.contributionMargin === null ? '—' : `${(results.contributionMargin * 100).toFixed(1)}%`}</dd></div>
      </dl>

      {/* Cenários */}
      <div>
        <p className="text-xs text-slate-500 mb-2">{t('goals.scenarios')} — {t('goals.scenarioHint')}</p>
        <div className="flex flex-wrap items-end gap-2 mb-3">
          {scenarios.map((pct, i) => (
            <div key={i} className="flex items-center gap-1">
              <input aria-label={t('goals.scenario', { pct })} type="number" min="0" max="99" step="0.5" value={pct} onChange={e => set('scenarios', scenarios.map((x, j) => (j === i ? Number(e.target.value) : x)))} className="field !py-1 w-20 text-right" />
              <span className="text-sm text-slate-500">%</span>
              {scenarios.length > 1 && <button onClick={() => set('scenarios', scenarios.filter((_, j) => j !== i))} className="btn-ghost" aria-label={t('profile.remove')}><Trash2 size={13} /></button>}
            </div>
          ))}
          <button onClick={() => set('scenarios', [...scenarios, 12])} className="btn-secondary !py-1 !px-2 text-xs"><Plus size={13} /></button>
          <div className="ml-auto flex flex-wrap gap-2">
            <div><label className="text-[11px] text-slate-500 block" htmlFor="g-cp">{t('goals.customPct')}</label><input id="g-cp" type="number" step="0.5" value={g.customPct ?? ''} onChange={e => set('customPct', numOrNull(e.target.value))} className="field !py-1 w-28 text-right" /></div>
            <div><label className="text-[11px] text-slate-500 block" htmlFor="g-cv">{t('goals.customProfit')}</label><input id="g-cv" type="number" step="0.01" value={g.customProfit ?? ''} onChange={e => set('customProfit', numOrNull(e.target.value))} className="field !py-1 w-36 text-right" /></div>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-blue-100">
                <th className="py-2 px-2 font-medium">{t('goals.goal')}</th>
                <th className="py-2 px-2 font-medium text-right">{t('goals.monthly')}</th>
                <th className="py-2 px-2 font-medium text-right">{t('goals.daily')}</th>
                <th className="py-2 px-2 font-medium text-right">{t('goals.orders')}</th>
                <th className="py-2 px-2 font-medium text-center">{t('goals.dashboardScenario')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} className={`border-b border-slate-100 ${row.key === 'be' ? 'font-semibold bg-blue-50/50' : ''}`}>
                  <td className="py-2 px-2">{row.label}</td>
                  <td className="py-2 px-2 text-right">{cell(row.r, 'monthly')}</td>
                  <td className="py-2 px-2 text-right">{cell(row.r, 'daily')}</td>
                  <td className="py-2 px-2 text-right">{cell(row.r, 'ordersPerDay')}</td>
                  <td className="py-2 px-2 text-center">
                    {row.pct !== undefined && (
                      <input type="radio" name="dash-scenario" aria-label={`${t('goals.dashboardScenario')}: ${row.label}`}
                        checked={(g.dashboardScenario ?? scenarios[0]) === row.pct} onChange={() => set('dashboardScenario', row.pct)} className="accent-blue-600" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-700 flex gap-2"><Info size={14} className="shrink-0 mt-0.5 text-blue-600" /> {t('goals.profitNote')}</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="label">{t('goals.includedTitle')}</h3>
          {basis.included.length === 0 ? <p className="text-xs text-slate-400">—</p> : (
            <ul className="text-xs text-slate-700 space-y-0.5">
              {basis.included.map((l, i) => (
                <li key={i} className="flex justify-between gap-2 border-b border-slate-100 py-0.5">
                  <span>{['ownerPay', 'mixFees', 'cogsConsumed', 'cogsPurchases'].includes(l.label) ? t(`goals.included.${l.label}`) : l.label || '—'} <span className="text-slate-400">({t(l.kind === 'fixed' ? 'finance.fixed' : 'finance.variable')})</span></span>
                  <span className="font-mono">{l.pct !== undefined ? `${l.pct.toFixed(1)}%` : formatCurrency(l.amount ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
          {basis.assumptions.length > 0 && (
            <>
              <h3 className="label mt-3">{t('goals.assumptionsTitle')}</h3>
              <ul className="list-disc ml-5 text-xs text-slate-700">{[...new Set(basis.assumptions)].map(a => <li key={a}>{t(`goals.assumption.${a}`)}</li>)}</ul>
            </>
          )}
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-sm">
          <h3 className="font-semibold text-navy-900 mb-2">{t('goals.reference')}</h3>
          <ul className="space-y-1">
            <li className={`flex justify-between ${segment === 'full' ? 'font-semibold text-blue-900' : ''}`}><span>{t('goals.refFull')}{segment === 'full' && ` (${t('goals.refYours')})`}</span><span className="font-mono">{NRA_REFERENCE.full.toFixed(1)}%</span></li>
            <li className={`flex justify-between ${segment === 'limited' ? 'font-semibold text-blue-900' : ''}`}><span>{t('goals.refLimited')}{segment === 'limited' && ` (${t('goals.refYours')})`}</span><span className="font-mono">{NRA_REFERENCE.limited.toFixed(1)}%</span></li>
          </ul>
          <p className="text-xs text-slate-600 mt-2">{t('goals.refNote')}</p>
          <p className="text-xs text-amber-800 mt-1">{t('goals.refApprox')}</p>
          <a href={NRA_REFERENCE.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline inline-flex items-center gap-1 mt-1">
            {t('goals.source')}: National Restaurant Association ({NRA_REFERENCE.year}) <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </section>
  );
}
