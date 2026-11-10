import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, Upload, RefreshCw, Unplug, CheckCircle2, Clock, AlertTriangle, GitMerge, FileSpreadsheet, Check, X } from 'lucide-react';
import { useRestaurant } from '../../hooks/useRestaurant';
import { formatCurrency } from '../../lib/currency';
import { currentPeriod, formatPeriod } from '../../utils/finance';
import { salesChannels } from '../../utils/breakeven';
import { saveFinanceMonth } from '../../data/repo';
import {
  getBatches, getIntegrations, getSalesRecords, lastMapping, saveBatch, squareConnectUrl, squareDisconnect, squareSync, upsertSalesRecords,
  type ImportBatch, type Integration,
} from '../../data/importsRepo';
import { reconcile } from '../../lib/imports/reconcile';
import { summarizeMonth } from '../../lib/imports/aggregate';
import type { SalesRecord } from '../../lib/imports/normalize';
import { ImportWizard, type WizardResult } from './ImportWizard';
import type { FinanceMonth } from '../../types';

const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const;
const PLATFORM_NAMES: Record<string, string> = { square: 'Square', doordash: 'DoorDash', ubereats: 'Uber Eats', grubhub: 'Grubhub' };

export function useImports(restaurantId?: string) {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [r, b, i] = await Promise.all([getSalesRecords(restaurantId), getBatches(restaurantId), getIntegrations(restaurantId)]);
      setRecords(r); setBatches(b); setIntegrations(i); setAvailable(true);
    } catch { setAvailable(false); }
    setLoading(false);
  }, [restaurantId]);
  useEffect(() => { setLoading(true); reload(); }, [reload]);
  return { records, batches, integrations, available, loading, reload };
}

export function useChannelLabel() {
  const { t } = useTranslation();
  const { current } = useRestaurant();
  return (id: string) => {
    if (PLATFORM_NAMES[id]) return PLATFORM_NAMES[id];
    const custom = current?.profile.delivery?.find(d => d.id === id);
    if (custom?.name) return custom.name;
    const k = `channels.${id}`;
    const v = t(k);
    return v === k ? id : v;
  };
}

export function IntegrationsPanel({ months, onApplied }: { months: FinanceMonth[]; onApplied: () => void }) {
  const { t, i18n } = useTranslation();
  const { current: restaurant } = useRestaurant();
  const locale = LOCALES[(i18n.language as keyof typeof LOCALES)] ?? 'pt-BR';
  const label = useChannelLabel();
  const { records, batches, integrations, available, reload } = useImports(restaurant?.id);
  const [period, setPeriod] = useState(currentPeriod());
  const [unit, setUnit] = useState('');
  const [wizard, setWizard] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState('');

  // Retorno do OAuth do Square (?integration=square&status=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('integration') === 'square') {
      const st = p.get('status') ?? 'error';
      setNotice({ kind: st === 'connected' ? 'ok' : 'warn', text: t(`integ.squareReturn.${st}`, t('integ.squareReturn.error')) });
      p.delete('integration'); p.delete('status');
      window.history.replaceState(null, '', `${window.location.pathname}${p.toString() ? `?${p}` : ''}`);
      reload();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const square = integrations.find(i => i.provider === 'square');
  const units = useMemo(() => [...new Set([
    ...(restaurant?.profile.unitName ? [restaurant.profile.unitName] : []),
    ...(square?.locations ?? []).map(l => l.name),
    ...records.map(r => r.unit),
  ].filter(Boolean))], [restaurant?.profile.unitName, square, records]);
  const summary = useMemo(() => summarizeMonth(records, period, unit || undefined), [records, period, unit]);
  const reviewPairs = useMemo(() => records.filter(r => r.source === 'square' && r.matchStatus === 'review').map(s => ({
    s, d: records.find(d => d.source === s.matchedSource && d.recordKey === s.matchedKey),
  })).filter(p => !unit || p.s.unit === unit), [records, unit]);
  const periodOptions = useMemo(() => {
    const set = new Set<string>([currentPeriod(), ...months.map(m => m.period), ...records.flatMap(r => [r.saleDate?.slice(0, 7), r.payoutDate?.slice(0, 7)]).filter((x): x is string => !!x)]);
    return [...set].sort().reverse();
  }, [months, records]);

  if (!restaurant) return null;
  const rid = restaurant.id;
  const channelOptions = salesChannels(restaurant.profile).map(c => ({ id: c.id, label: label(c.id) }));

  const runReconcile = async (all: SalesRecord[]) => {
    const res = reconcile(all.filter(r => r.source === 'square'), all.filter(r => r.source !== 'square'));
    if (res.updates.length) await upsertSalesRecords(rid, res.updates);
    return res;
  };

  const onImport = async (w: WizardResult) => {
    // Preserva decisões de conciliação dos registros que já existem.
    const prev = new Map(records.filter(r => r.source === w.batch.source).map(r => [r.recordKey, r] as const));
    const recs = w.records.map(r => {
      const p = prev.get(r.recordKey);
      return p ? { ...r, matchStatus: p.matchStatus, matchedSource: p.matchedSource, matchedKey: p.matchedKey } : r;
    });
    const batchId = await saveBatch(rid, w.batch, w.existingBatchId);
    await upsertSalesRecords(rid, recs, batchId);
    const all = [...records.filter(r => !(r.source === w.batch.source && recs.some(x => x.recordKey === r.recordKey))), ...recs];
    const rec = await runReconcile(all);
    setWizard(null);
    setNotice({ kind: 'ok', text: `${t('integ.imported', w.diff)} ${t('integ.reconciled', { matched: rec.matched, review: rec.review })}` });
    await reload();
  };

  const decide = async (s: SalesRecord, d: SalesRecord | undefined, same: boolean) => {
    const updates: SalesRecord[] = same
      ? [{ ...s, matchStatus: 'matched' }, ...(d ? [{ ...d, matchStatus: 'matched' as const }] : [])]
      : [{ ...s, matchStatus: 'distinct' }, ...(d ? [{ ...d, matchStatus: 'none' as const, matchedSource: null, matchedKey: null }] : [])];
    await upsertSalesRecords(rid, updates);
    await reload();
  };

  const apply = async () => {
    const all = summarizeMonth(records, period);
    const m = months.find(x => x.period === period) ?? { restaurantId: rid, period, status: 'open' as const, estimateSnapshot: null, entries: [] };
    const imported = {
      channels: Object.fromEntries(all.channels.map(c => [c.channel, c.netSales])),
      fees: Object.fromEntries(all.channels.map(c => [c.channel, Math.round((c.commissions + c.promotions + c.otherFees) * 100) / 100])),
      payouts: Object.fromEntries(all.channels.map(c => [c.channel, c.payoutsInMonth])),
      appliedAt: new Date().toISOString(), recordCount: all.recordCount,
    };
    await saveFinanceMonth({ ...m, estimateSnapshot: m.estimateSnapshot ?? structuredClone(restaurant.budget), sales: { ...(m.sales ?? {}), imported } });
    setNotice({ kind: 'ok', text: t('integ.applied', { month: formatPeriod(period, locale) }) });
    onApplied();
  };

  const connectSquare = async () => {
    setBusy('square');
    try {
      const { url } = await squareConnectUrl(rid, `${window.location.origin}/app`);
      window.location.href = url;
    } catch { setNotice({ kind: 'warn', text: t('integ.notConfigured') }); setBusy(''); }
  };
  const syncSquare = async () => {
    setBusy('sync');
    const [y, mo] = period.split('-').map(Number);
    const end = new Date(y, mo, 0).getDate();
    try {
      const r = await squareSync(rid, `${period}-01`, `${period}-${String(end).padStart(2, '0')}`);
      const fresh = await getSalesRecords(rid);
      const rec = await runReconcile(fresh);
      setNotice({ kind: 'ok', text: `${t('integ.syncDone', r)} ${t('integ.reconciled', { matched: rec.matched, review: rec.review })}` });
      await reload();
    } catch (e) { setNotice({ kind: 'warn', text: (e as Error).message }); }
    setBusy('');
  };

  const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
  const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(locale) : '—');

  return (
    <div className="space-y-6">
      <section className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Plug size={18} className="text-blue-600" aria-hidden="true" />
          <h2 className="font-semibold text-navy-900">{t('integ.title')}</h2>
          <div className="ml-auto flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="int-unit">{t('integ.unit')}</label>
            <select id="int-unit" value={unit} onChange={e => setUnit(e.target.value)} className="field !w-auto !py-1.5">
              <option value="">{t('integ.allUnits')}</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <label className="sr-only" htmlFor="int-period">{t('integ.month')}</label>
            <select id="int-period" value={period} onChange={e => setPeriod(e.target.value)} className="field !w-auto !py-1.5">
              {periodOptions.map(p => <option key={p} value={p}>{formatPeriod(p, locale)}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">{t('integ.hint')}</p>
        {!available && <p className="mt-3 text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">{t('integ.notConfigured')} (005_integrations.sql)</p>}
        {notice && (
          <p className={`mt-3 text-sm rounded-lg px-3 py-2 flex gap-2 ${notice.kind === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-amber-50 border border-amber-200 text-amber-900'}`} role="status">
            {notice.kind === 'ok' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />} {notice.text}
            <button onClick={() => setNotice(null)} className="ml-auto btn-ghost !p-0.5" aria-label={t('integ.cancel')}><X size={14} /></button>
          </p>
        )}

        {/* Fontes */}
        <h3 className="label mt-4">{t('integ.sources')}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-100 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-navy-900">Square</span>
              <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">{t('integ.direct')}</span>
              <span className={`ml-auto text-xs font-semibold ${square?.status === 'connected' ? 'text-emerald-700' : 'text-slate-500'}`}>{square?.status === 'connected' ? t('integ.connected') : t('integ.disconnected')}</span>
            </div>
            <p className="text-xs text-slate-500">{t('integ.squareHint')}</p>
            {square?.status === 'connected' && (
              <p className="text-xs text-slate-600">{square.locations.map(l => l.name).join(', ')}{square.lastSyncAt && ` · ${t('integ.lastSync', { date: new Date(square.lastSyncAt).toLocaleString(locale) })}`}</p>
            )}
            {square?.lastError && <p className="text-xs text-red-700">{square.lastError}</p>}
            <div className="flex flex-wrap gap-2">
              {square?.status === 'connected' ? (
                <>
                  <button onClick={syncSquare} disabled={!!busy} className="btn-primary !py-1.5"><RefreshCw size={14} className={busy === 'sync' ? 'animate-spin' : ''} /> {busy === 'sync' ? t('integ.syncing') : t('integ.syncPeriod')}</button>
                  {restaurant.role === 'owner' && <button onClick={async () => { await squareDisconnect(rid).catch(() => null); reload(); }} className="btn-secondary !py-1.5"><Unplug size={14} /> {t('integ.disconnect')}</button>}
                </>
              ) : restaurant.role === 'owner' && (
                <button onClick={connectSquare} disabled={!!busy} className="btn-primary !py-1.5"><Plug size={14} /> {square ? t('integ.reconnect') : t('integ.connect')}</button>
              )}
            </div>
          </div>

          {(['doordash', 'ubereats', 'grubhub'] as const).map(p => (
            <div key={p} className="rounded-xl border border-blue-100 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-navy-900">{PLATFORM_NAMES[p]}</span>
                <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">{t('integ.csv')}</span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} aria-hidden="true" /> {t('integ.auto')}: {t('integ.pendingApproval')}</p>
              <button onClick={() => setWizard(p)} disabled={!available} className="btn-secondary !py-1.5"><Upload size={14} /> {t('integ.importCsv')}</button>
            </div>
          ))}

          <div className="rounded-xl border border-dashed border-blue-200 p-4 space-y-2">
            <div className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-blue-600" aria-hidden="true" /><span className="font-semibold text-navy-900">{t('integ.genericCsv')}</span></div>
            <button onClick={() => setWizard('generic')} disabled={!available} className="btn-secondary !py-1.5"><Upload size={14} /> {t('integ.importCsv')}</button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">{t('integ.pendingApprovalHint')} {t('integ.availability')}</p>
      </section>

      {/* Resumo do mês */}
      <section className="card p-4 md:p-5" aria-labelledby="imp-sum">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 id="imp-sum" className="font-semibold text-navy-900">{t('integ.summary')} — {formatPeriod(period, locale)}</h2>
          <span className="text-[11px] font-semibold bg-violet-100 text-violet-800 rounded-full px-2 py-0.5">{t('integ.origin.imported')}</span>
          {summary.divergences > 0 && <span className="text-[11px] font-semibold bg-red-100 text-red-800 rounded-full px-2 py-0.5">{t('integ.divergencesTotal', { n: summary.divergences })}</span>}
          <button onClick={apply} disabled={!summary.channels.length} className="btn-primary ml-auto" title={t('integ.applyHint')}>{t('integ.apply')}</button>
        </div>
        {summary.channels.length === 0 ? <p className="text-sm text-slate-400">{t('integ.noData')}</p> : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-blue-100">
                  {(['channel', 'sales', 'fees', 'rate', 'payouts', 'later', 'div'] as const).map(c => <th key={c} className={`py-2 px-2 font-medium ${c === 'channel' ? '' : 'text-right'}`}>{t(`integ.col.${c}`)}</th>)}
                </tr>
              </thead>
              <tbody>
                {summary.channels.map(c => (
                  <tr key={c.channel} className="border-b border-slate-100">
                    <td className="py-2 px-2 font-medium">{label(c.channel)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(c.netSales)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(c.commissions + c.promotions + c.otherFees)}</td>
                    <td className="py-2 px-2 text-right font-mono">{pct(c.effectiveFeeRate)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(c.payoutsInMonth)}</td>
                    <td className="py-2 px-2 text-right font-mono">{c.salesPaidLater ? formatCurrency(c.salesPaidLater) : '—'}</td>
                    <td className={`py-2 px-2 text-right ${c.payoutDivergences ? 'text-red-700 font-semibold' : 'text-slate-400'}`}>{c.payoutDivergences || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 px-2">{t('finance.total')}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(summary.totals.netSales)}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(summary.totals.fees)}</td>
                  <td className="py-2 px-2 text-right font-mono">{pct(summary.totals.netSales > 0 ? summary.totals.fees / summary.totals.netSales : null)}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(summary.totals.payouts)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">{t('integ.salesPaidLaterHint')} {t('integ.applyHint')}</p>
      </section>

      {/* Revisão */}
      <section className="card p-4 md:p-5" aria-labelledby="imp-rev">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <GitMerge size={16} className="text-blue-600" aria-hidden="true" />
          <h2 id="imp-rev" className="font-semibold text-navy-900">{t('integ.review')}</h2>
          {summary.reviewAmount !== 0 && <span className="text-xs text-amber-800">{t('integ.pendingReviewAmount', { v: formatCurrency(summary.reviewAmount) })}</span>}
          <button onClick={async () => { const r = await runReconcile(records); setNotice({ kind: 'ok', text: t('integ.reconciled', { matched: r.matched, review: r.review }) }); reload(); }} className="btn-secondary ml-auto !py-1.5"><RefreshCw size={14} /> {t('integ.reconcileNow')}</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">{t('integ.reviewHint')}</p>
        {reviewPairs.length === 0 ? <p className="text-sm text-slate-400">{t('integ.noReview')}</p> : (
          <ul className="space-y-2">
            {reviewPairs.map(({ s, d }) => (
              <li key={s.recordKey} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1 min-w-[16rem]">{t('integ.reviewItem', {
                  sq: s.externalRef || s.externalOrderId, sqAmount: formatCurrency(s.netSales), sqDate: fmtDate(s.saleDate),
                  platform: PLATFORM_NAMES[d?.source ?? ''] ?? d?.source ?? '?', dd: d?.externalOrderId ?? '?', ddAmount: d ? formatCurrency(d.netSales) : '—', ddDate: fmtDate(d?.saleDate ?? null),
                })}</span>
                <button onClick={() => decide(s, d, true)} className="btn-secondary !py-1"><Check size={14} /> {t('integ.same')}</button>
                <button onClick={() => decide(s, d, false)} className="btn-secondary !py-1"><X size={14} /> {t('integ.different')}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Histórico */}
      <section className="card p-4 md:p-5">
        <h2 className="font-semibold text-navy-900 mb-2">{t('integ.batches')}</h2>
        {batches.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {batches.slice(0, 30).map(b => (
              <li key={b.id} className="py-2 flex flex-wrap gap-2">
                <span className="font-medium text-navy-900">{PLATFORM_NAMES[b.source] ?? (b.summary.platformName as string) ?? b.source}</span>
                <span className="text-slate-600">{b.fileName ?? t('integ.direct')}</span>
                <span className="text-slate-500">{fmtDate(b.periodStart)} – {fmtDate(b.periodEnd)} · {b.rowCount} · +{b.inserted} / ↻{b.updated}</span>
                <span className="ml-auto text-xs text-slate-400">{new Date(b.updatedAt).toLocaleString(locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {wizard && (
        <ImportWizard
          initialSource={wizard}
          channels={channelOptions}
          units={units}
          existing={records}
          batches={batches}
          savedMapping={src => lastMapping(rid, src)}
          onConfirm={onImport}
          onClose={() => setWizard(null)}
        />
      )}
    </div>
  );
}
