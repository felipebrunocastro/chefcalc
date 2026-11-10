import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { dayResult, rangeResult, weekRange, type ConsolidateInput, type DayStatus, type Filters, type Line, type Conflict } from '../../lib/pos/consolidate';
import { DayDetail, type DayActions } from './DayDetail';
import type { Payment } from '../../lib/pos/types';

type Mode = 'day' | 'week' | 'month' | 'year';
const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const;
export const STATUS_STYLE: Record<DayStatus, string> = {
  none: 'bg-white border-slate-200 text-slate-400',
  zero: 'bg-slate-100 border-slate-300 text-slate-600',
  open: 'bg-sky-50 border-sky-400 text-sky-900',
  pending: 'bg-amber-50 border-amber-400 text-amber-900',
  consolidated: 'bg-emerald-50 border-emerald-500 text-emerald-900',
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monthDays = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

export function CalendarView({ input, built, units, today, actions, initialDate }: {
  input: ConsolidateInput; built: { lines: Line[]; conflicts: Conflict[] }; units: string[]; today: string; actions: DayActions; initialDate?: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = LOCALES[(i18n.language as keyof typeof LOCALES)] ?? 'pt-BR';
  const [mode, setMode] = useState<Mode>('month');
  const [date, setDate] = useState(initialDate ?? today);
  const [list, setList] = useState(false);
  const [f, setF] = useState<Filters>({});
  const [y, m] = date.split('-').map(Number);
  const channels = useMemo(() => [...new Set(built.lines.map(l => l.channel).filter(Boolean))], [built.lines]);
  const fmtDay = (s: string, o: Intl.DateTimeFormatOptions) => new Date(`${s}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...o });

  const move = (dir: 1 | -1) => {
    if (mode === 'day') setDate(addDays(date, dir));
    else if (mode === 'week') setDate(addDays(date, 7 * dir));
    else if (mode === 'month') setDate(iso(new Date(Date.UTC(y, m - 1 + dir, 1, 12))));
    else setDate(iso(new Date(Date.UTC(y + dir, m - 1, 1, 12))));
  };
  const openDay = (d: string) => { setDate(d); setMode('day'); };
  const title = mode === 'day' ? fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : mode === 'week' ? (() => { const w = weekRange(date); return `${fmtDay(w.from, { day: 'numeric', month: 'short' })} – ${fmtDay(w.to, { day: 'numeric', month: 'short', year: 'numeric' })}`; })()
    : mode === 'month' ? fmtDay(date, { month: 'long', year: 'numeric' }) : String(y);

  const Legend = () => (
    <ul className="flex flex-wrap gap-2 text-[11px]" aria-label={t('cal.legend')}>
      {(['none', 'zero', 'open', 'pending', 'consolidated'] as DayStatus[]).map(s => <li key={s} className={`border rounded-full px-2 py-0.5 ${STATUS_STYLE[s]}`}>{t(`cal.status.${s}`)}</li>)}
    </ul>
  );

  const monthView = () => {
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${String(monthDays(y, m - 1)).padStart(2, '0')}`;
    const r = rangeResult(first, last, input, built, f);
    const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
    const weeks: { label: string; net: number }[] = [];
    for (let i = 0; i < r.days.length; i += 7) { /* por semana do mês (seg-dom) */ }
    const byWeek = new Map<string, number>();
    for (const d of r.days) { const w = weekRange(d.date).from; byWeek.set(w, (byWeek.get(w) ?? 0) + d.net); }
    [...byWeek.entries()].forEach(([from, net], i) => weeks.push({ label: `${t('cal.weekN', { n: i + 1 })} · ${fmtDay(from, { day: 'numeric', month: 'short' })}`, net }));
    const maxW = Math.max(1, ...weeks.map(w => w.net));
    return (
      <div className="space-y-4">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label={t('cal.total')} value={formatCurrency(r.net)} strong />
          <Kpi label={t('cal.daysWithSales')} value={String(r.daysWithSales)} />
          <Kpi label={t('day.fees')} value={formatCurrency(r.fees)} />
          <Kpi label={t('day.payouts')} value={formatCurrency(r.payouts)} />
        </dl>
        {list ? (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-blue-100 bg-white">
            {r.days.filter(d => d.status !== 'none').map(d => (
              <li key={d.date}><button onClick={() => openDay(d.date)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50">
                <span className="w-28 font-medium">{fmtDay(d.date, { weekday: 'short', day: 'numeric' })}</span>
                <span className={`text-[11px] border rounded-full px-2 py-0.5 ${STATUS_STYLE[d.status]}`}>{t(`cal.status.${d.status}`)}</span>
                <span className="ml-auto font-mono font-bold text-lg">{formatCurrency(d.net)}</span>
              </button></li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2" role="grid" aria-label={title}>
            {(t('cal.weekdays', { returnObjects: true }) as string[]).map(w => <div key={w} className="text-center text-[11px] font-semibold text-slate-500" role="columnheader">{w}</div>)}
            {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
            {r.days.map(d => (
              <button key={d.date} role="gridcell" onClick={() => openDay(d.date)} aria-label={`${fmtDay(d.date, { day: 'numeric', month: 'long' })}: ${formatCurrency(d.net)} — ${t(`cal.status.${d.status}`)}`}
                className={`rounded-xl border-2 min-h-[4.5rem] sm:min-h-[5.5rem] p-1 sm:p-2 text-left flex flex-col hover:ring-2 hover:ring-blue-300 ${STATUS_STYLE[d.status]} ${d.date === today ? 'ring-2 ring-blue-600' : ''}`}>
                <span className="text-xs font-bold">{Number(d.date.slice(8))}</span>
                {d.status !== 'none' && <span className="mt-auto font-mono font-bold text-[11px] sm:text-sm leading-tight break-all">{formatCurrency(d.net)}</span>}
                {d.provisional && <span className="text-[9px] font-semibold uppercase">{t('pos.provisional')}</span>}
              </button>
            ))}
          </div>
        )}
        <div>
          <h3 className="label">{t('cal.weekCompare')}</h3>
          <ul className="space-y-1">
            {weeks.map(w => <li key={w.label} className="flex items-center gap-2 text-sm"><span className="w-40 shrink-0 truncate">{w.label}</span><span className="flex-1 h-3 bg-slate-100 rounded"><span className="block h-3 bg-blue-600 rounded" style={{ width: `${(w.net / maxW) * 100}%` }} /></span><span className="w-28 text-right font-mono">{formatCurrency(w.net)}</span></li>)}
          </ul>
        </div>
      </div>
    );
  };

  const weekView = () => {
    const w = weekRange(date);
    const r = rangeResult(w.from, w.to, input, built, f);
    const max = Math.max(1, ...r.days.map(d => d.net));
    return (
      <div className="space-y-4">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label={t('cal.total')} value={formatCurrency(r.net)} strong />
          <Kpi label={t('cal.daysWithSales')} value={String(r.daysWithSales)} />
          <Kpi label={t('day.orders')} value={r.orders === null ? '—' : String(r.orders)} />
          <Kpi label={t('day.ticket')} value={r.ticket === null ? '—' : formatCurrency(r.ticket)} />
        </dl>
        <ul className="space-y-1.5">
          {r.days.map(d => (
            <li key={d.date}><button onClick={() => openDay(d.date)} className="w-full flex items-center gap-2 text-sm hover:bg-blue-50 rounded-lg px-1 py-1">
              <span className="w-24 shrink-0 text-left">{fmtDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${STATUS_STYLE[d.status]}`} aria-label={t(`cal.status.${d.status}`)} />
              <span className="flex-1 h-4 bg-slate-100 rounded"><span className="block h-4 bg-blue-600 rounded" style={{ width: `${(d.net / max) * 100}%` }} /></span>
              <span className="w-28 text-right font-mono font-semibold">{formatCurrency(d.net)}</span>
            </button></li>
          ))}
        </ul>
        <ChannelSplit byChannel={r.byChannel} />
      </div>
    );
  };

  const yearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const first = `${y}-${String(i + 1).padStart(2, '0')}-01`;
      const last = `${y}-${String(i + 1).padStart(2, '0')}-${String(monthDays(y, i)).padStart(2, '0')}`;
      return { i, first, r: rangeResult(first, last, input, built, f) };
    });
    const total = months.reduce((a, x) => a + x.r.net, 0);
    const max = Math.max(1, ...months.map(x => x.r.net));
    return (
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2"><Kpi label={t('cal.yearTotal')} value={formatCurrency(total)} strong /></dl>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {months.map(x => (
            <button key={x.i} onClick={() => { setDate(x.first); setMode('month'); }} className="rounded-2xl border border-blue-100 bg-white p-3 text-left hover:border-blue-400">
              <div className="text-sm font-semibold capitalize text-navy-900">{fmtDay(x.first, { month: 'long' })}</div>
              <div className="font-mono font-bold text-lg">{formatCurrency(x.r.net)}</div>
              <div className="h-1.5 bg-slate-100 rounded mt-1"><div className="h-1.5 bg-blue-600 rounded" style={{ width: `${(x.r.net / max) * 100}%` }} /></div>
              <div className="text-[11px] text-slate-500 mt-1">{t('cal.daysWithSales')}: {x.r.daysWithSales}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4" aria-label={t('cal.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-2xl bg-white border border-blue-100 p-1" role="tablist" aria-label={t('cal.title')}>
          {(['day', 'week', 'month', 'year'] as Mode[]).map(k => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${mode === k ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{t(`cal.${k}`)}</button>)}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="btn-secondary !p-2.5" aria-label={t('cal.prev')}><ChevronLeft size={18} /></button>
          <span className="min-w-[10rem] text-center font-semibold capitalize text-navy-900" aria-live="polite" data-testid="cal-title">{title}</span>
          <button onClick={() => move(1)} className="btn-secondary !p-2.5" aria-label={t('cal.next')}><ChevronRight size={18} /></button>
          <button onClick={() => setDate(today)} className="btn-secondary !py-2">{t('cal.today')}</button>
        </div>
        {mode === 'month' && <button onClick={() => setList(l => !l)} className="btn-secondary !py-2 ml-auto" aria-pressed={list}>{list ? <><CalendarDays size={16} /> {t('cal.gridView')}</> : <><List size={16} /> {t('cal.listView')}</>}</button>}
      </div>
      <div className="flex flex-wrap gap-2">
        {units.length > 1 && <select aria-label={t('pos.unit')} value={f.unit ?? ''} onChange={e => setF(x => ({ ...x, unit: e.target.value || undefined }))} className="field !w-auto !py-2"><option value="">{t('cal.allUnits')}</option>{units.map(u => <option key={u} value={u}>{u || t('pos.mainUnit')}</option>)}</select>}
        <select aria-label={t('day.byChannel')} value={f.channel ?? ''} onChange={e => setF(x => ({ ...x, channel: e.target.value || undefined }))} className="field !w-auto !py-2"><option value="">{t('cal.allChannels')}</option>{channels.map(c => <option key={c} value={c}>{t(`day.channel.${c}`, c)}</option>)}</select>
        <select aria-label={t('day.byPayment')} value={f.payment ?? ''} onChange={e => setF(x => ({ ...x, payment: (e.target.value || undefined) as Payment | undefined }))} className="field !w-auto !py-2"><option value="">{t('cal.allPayments')}</option>{(['cash', 'card', 'online', 'other'] as Payment[]).map(p => <option key={p} value={p}>{t(`day.payment.${p}`)}</option>)}</select>
      </div>
      <Legend />
      {mode === 'day' && <DayDetail result={dayResult(date, input, built, f)} input={input} actions={actions} />}
      {mode === 'week' && weekView()}
      {mode === 'month' && monthView()}
      {mode === 'year' && yearView()}
    </section>
  );
}

export function Kpi({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${strong ? 'bg-navy-900 text-white' : 'bg-white border border-blue-100'}`}>
      <dt className={`text-xs ${strong ? 'text-blue-200' : 'text-slate-500'}`}>{label}</dt>
      <dd className="font-mono font-bold text-lg sm:text-xl">{value}</dd>
    </div>
  );
}

export function ChannelSplit({ byChannel }: { byChannel: Record<string, number> }) {
  const { t } = useTranslation();
  const entries = Object.entries(byChannel).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  if (!entries.length) return null;
  return (
    <div>
      <h3 className="label">{t('day.byChannel')}</h3>
      <ul className="space-y-1">
        {entries.map(([ch, v]) => <li key={ch} className="flex items-center gap-2 text-sm"><span className="w-28 shrink-0">{t(`day.channel.${ch}`, ch)}</span><span className="flex-1 h-3 bg-slate-100 rounded"><span className="block h-3 bg-sky-400 rounded" style={{ width: `${(v / total) * 100}%` }} /></span><span className="w-28 text-right font-mono">{formatCurrency(v)}</span></li>)}
      </ul>
    </div>
  );
}
