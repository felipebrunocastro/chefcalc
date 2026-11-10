import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Clock, Lock, Unlock, PackageX } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { cashResult } from '../../lib/pos/cash';
import type { ConsolidateInput, DayResult } from '../../lib/pos/consolidate';
import { Kpi } from './CalendarView';

export interface DayActions {
  resolveDetailed: (summaryId: string, keep: boolean) => Promise<void>;
  resolveOverlap: (summaryId: string, how: 'deduct' | 'separate') => Promise<void>;
  reconcile: () => Promise<void>;
  canOperate: boolean;
}

export function DayDetail({ result: d, input, actions }: { result: DayResult; input: ConsolidateInput; actions: DayActions }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—');
  const ch = (c: string) => t(`day.channel.${c}`, c);
  const reports = input.summaries.filter(s => s.opDate === d.date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const allChannels = [...new Set([...Object.keys(d.byChannel), ...d.pendingChannels])];
  return (
    <div className="space-y-4" data-testid="day-detail">
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${d.physicalClosed ? 'bg-emerald-100 text-emerald-900' : d.sessions.length ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-600'}`}>
          {d.physicalClosed ? <Lock size={14} /> : <Unlock size={14} />} {d.physicalClosed ? t('pos.physicalClosed') : t('pos.physicalOpen')}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${d.consolidated ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
          {d.consolidated ? <CheckCircle2 size={14} /> : <Clock size={14} />} {d.consolidated ? t('pos.consolidated') : t('pos.notConsolidated')}
        </span>
        {d.provisional && <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold bg-amber-200 text-amber-950"><AlertTriangle size={14} /> {t('pos.provisional')} · {t('day.pendingAmount', { v: formatCurrency(d.pendingAmount) })}</span>}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label={t('day.net')} value={formatCurrency(d.net)} strong />
        <Kpi label={t('day.orders')} value={d.orders === null ? '—' : String(d.orders)} />
        <Kpi label={t('day.ticket')} value={d.ticket === null ? '—' : formatCurrency(d.ticket)} />
        <Kpi label={t('day.payouts')} value={formatCurrency(d.payouts)} />
      </dl>
      {d.ticket === null && d.net !== 0 && <p className="text-xs text-slate-500">{t('day.noTicket')}</p>}

      {d.status === 'none' && <p className="text-slate-500">{t('day.noData')}</p>}

      {allChannels.length > 0 && (
        <section>
          <h3 className="label">{t('day.byChannel')}</h3>
          <ul className="grid sm:grid-cols-2 gap-2">
            {allChannels.map(c => {
              const v = d.byChannel[c];
              return (
                <li key={c} className={`rounded-2xl border-2 p-3 ${v ? 'border-emerald-200 bg-white' : 'border-dashed border-amber-300 bg-amber-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy-900">{ch(c)}</span>
                    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${v ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-900'}`}>{v ? t('day.registered') : t('day.pending')}</span>
                    {v && <span className="ml-auto font-mono font-bold text-lg">{formatCurrency(v.net)}</span>}
                  </div>
                  {v && <div className="text-xs text-slate-500 mt-1">{v.sources.map(s => t(`day.origin.${s}`)).join(' · ')}{v.orders !== null ? ` · ${v.orders} ${t('day.orders').toLowerCase()}` : ''}</div>}
                  {v && !v.productDetail && <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><PackageX size={12} /> {t('day.noProductDetail')}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {Object.keys(d.byPayment).length > 0 && (
        <section>
          <h3 className="label">{t('day.byPayment')}</h3>
          <div className="flex flex-wrap gap-2">{Object.entries(d.byPayment).map(([p, v]) => <span key={p} className="rounded-xl bg-white border border-blue-100 px-3 py-1.5 text-sm">{t(`day.payment.${p}`)}: <b className="font-mono">{formatCurrency(v)}</b></span>)}</div>
        </section>
      )}

      {d.conflicts.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2">
          <h3 className="font-semibold text-amber-900 flex items-center gap-1.5"><AlertTriangle size={16} /> {t('day.conflicts')}</h3>
          {d.conflicts.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-[14rem]">
                {c.kind === 'detailedVsSummary' && t('day.detailedVsSummary', { channel: ch(c.channel), d: formatCurrency(c.detailedAmount ?? 0), s: formatCurrency(c.amount) })}
                {c.kind === 'aggregateOverlap' && t('day.aggregateOverlap', { v: formatCurrency(c.amount) })}
                {c.kind === 'squareReview' && t('day.squareReview', { v: formatCurrency(c.amount) })}
              </span>
              {actions.canOperate && c.kind === 'detailedVsSummary' && c.summaryId && <>
                <button onClick={() => actions.resolveDetailed(c.summaryId!, false)} className="btn-primary !py-2">{t('day.replace')}</button>
                <button onClick={() => actions.resolveDetailed(c.summaryId!, true)} className="btn-secondary !py-2">{t('day.keep')}</button>
              </>}
              {actions.canOperate && c.kind === 'aggregateOverlap' && c.summaryId && <>
                <button onClick={() => actions.resolveOverlap(c.summaryId!, 'deduct')} className="btn-primary !py-2">{t('day.deduct')}</button>
                <button onClick={() => actions.resolveOverlap(c.summaryId!, 'separate')} className="btn-secondary !py-2">{t('day.separate')}</button>
              </>}
            </div>
          ))}
          {actions.canOperate && <button onClick={actions.reconcile} className="btn-secondary !py-2">{t('day.reconcile')}</button>}
        </section>
      )}

      <section>
        <h3 className="label">{t('day.products')}</h3>
        {d.products.length === 0 ? <p className="text-sm text-slate-500">{t('day.noProductDetail')}</p> : (
          <>
            <ol className="divide-y divide-slate-100 rounded-2xl border border-blue-100 bg-white">
              {d.products.slice(0, 15).map(p => <li key={p.name} className="flex justify-between px-3 py-2 text-sm"><span>{p.qty}× {p.name}</span><span className="font-mono">{formatCurrency(p.total)}</span></li>)}
            </ol>
            <p className="text-xs text-slate-500 mt-1">{t('day.coverage', { list: d.productChannels.map(ch).join(', ') })}</p>
          </>
        )}
      </section>

      {d.sessions.length > 0 && (
        <section>
          <h3 className="label">{t('day.shifts')}</h3>
          <ul className="space-y-2">
            {d.sessions.map(s => {
              const r = s.difference === null ? null : cashResult(s.difference);
              return (
                <li key={s.id} className="rounded-2xl border border-blue-100 bg-white p-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-semibold">{s.shift || '—'} · {s.unit || t('pos.mainUnit')} · {s.responsible}</span>
                  <span>{time(s.openedAt)} – {s.status === 'closed' ? time(s.closedAt) : t('pos.sessionOpen')}</span>
                  {s.status === 'closed' && <>
                    <span>{t('day.counted')}: <b className="font-mono">{formatCurrency(s.countedCash ?? 0)}</b></span>
                    <span>{t('day.expected')}: <b className="font-mono">{formatCurrency(s.expectedCash ?? 0)}</b></span>
                    <span className={r === 'ok' ? 'text-emerald-700 font-semibold' : r === 'short' ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      {r === 'ok' ? t('pos.ok') : r === 'short' ? t('pos.short', { v: formatCurrency(-(s.difference ?? 0)) }) : t('pos.over', { v: formatCurrency(s.difference ?? 0) })}
                    </span>
                  </>}
                  {s.corrections.length > 0 && <span className="w-full text-xs text-slate-500">{t('pos.corrections')}: {s.corrections.map(c => `${new Date(c.at).toLocaleString(locale)} · ${c.byEmail ?? ''} · ${c.reason} (${formatCurrency(c.from)} → ${formatCurrency(c.to)})`).join(' | ')}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h3 className="label">{t('day.history')}</h3>
        {reports.length === 0 ? <p className="text-sm text-slate-500">{t('day.noHistory')}</p> : (
          <ul className="text-sm space-y-1">
            {reports.map(r => (
              <li key={r.id} className={`flex flex-wrap gap-2 ${r.status === 'replaced' ? 'line-through text-slate-400' : ''}`}>
                <span className="font-medium">{r.channel === '__day__' ? t('cal.status.zero') : r.sourceName || ch(r.channel)}</span>
                <span className="font-mono">{formatCurrency(r.grossSales - r.discounts - r.refunds)}</span>
                <span className="text-slate-500">{new Date(r.createdAt).toLocaleString(locale)} · {r.createdByEmail ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
