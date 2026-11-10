import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Modal, BigNumberInput } from './Modal';
import { formatCurrency } from '../../lib/currency';
import { cashResult } from '../../lib/pos/cash';
import type { CashMovement, Payment } from '../../lib/pos/types';

const n = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

export function OpenDialog({ units, defaultResponsible, busy, onConfirm, onClose }: {
  units: string[]; defaultResponsible: string; busy: boolean; onClose: () => void;
  onConfirm: (v: { unit: string; shift: string; responsible: string; openingCash: number }) => void;
}) {
  const { t } = useTranslation();
  const [unit, setUnit] = useState(units[0] ?? '');
  const [shift, setShift] = useState(() => { const h = new Date().getHours(); return t(`pos.shifts.${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'night'}`); });
  const [responsible, setResponsible] = useState(defaultResponsible);
  const [cash, setCash] = useState('');
  const ok = !Number.isNaN(n(cash)) && n(cash) >= 0 && responsible.trim();
  return (
    <Modal title={t('pos.openTitle')} onClose={onClose} footer={<>
      <button onClick={onClose} className="btn-secondary !py-3">{t('pos.back')}</button>
      <button onClick={() => ok && onConfirm({ unit, shift, responsible: responsible.trim(), openingCash: n(cash) })} disabled={!ok || busy} className="btn-primary !py-3 !px-6 text-base">{busy ? t('pos.saving') : t('pos.confirmOpen')}</button>
    </>}>
      {units.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-600 mb-2">{t('pos.chooseUnit')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {units.map(u => <button key={u} type="button" onClick={() => setUnit(u)} aria-pressed={unit === u} className={`rounded-2xl border-2 px-4 py-3 text-left font-semibold ${unit === u ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200'}`}>{u || t('pos.mainUnit')}</button>)}
          </div>
        </fieldset>
      )}
      <BigNumberInput id="open-cash" label={t('pos.openingCash')} value={cash} onChange={setCash} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="open-resp" className="block text-sm font-medium text-slate-600 mb-1">{t('pos.responsible')}</label>
          <input id="open-resp" value={responsible} onChange={e => setResponsible(e.target.value)} className="field !py-3 text-base" />
        </div>
        <div>
          <label htmlFor="open-shift" className="block text-sm font-medium text-slate-600 mb-1">{t('pos.shift')}</label>
          <input id="open-shift" list="shift-list" value={shift} onChange={e => setShift(e.target.value)} className="field !py-3 text-base" />
          <datalist id="shift-list">{(['morning', 'afternoon', 'night'] as const).map(s => <option key={s} value={t(`pos.shifts.${s}`)} />)}</datalist>
        </div>
      </div>
    </Modal>
  );
}

export function MovementDialog({ busy, responsible, onConfirm, onClose }: {
  busy: boolean; responsible: string; onClose: () => void; onConfirm: (v: { kind: CashMovement['kind']; amount: number; reason: string; responsible: string }) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<CashMovement['kind']>('withdrawal');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [who, setWho] = useState(responsible);
  const ok = n(amount) > 0 && reason.trim();
  return (
    <Modal title={t('pos.moveTitle')} onClose={onClose} footer={<>
      <button onClick={onClose} className="btn-secondary !py-3">{t('pos.back')}</button>
      <button onClick={() => ok && onConfirm({ kind, amount: n(amount), reason: reason.trim(), responsible: who.trim() })} disabled={!ok || busy} className="btn-primary !py-3 !px-6 text-base">{busy ? t('pos.saving') : t('pos.register')}</button>
    </>}>
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {(['supply', 'withdrawal', 'refund'] as const).map(k => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={`rounded-2xl border-2 px-3 py-3 text-sm font-semibold ${kind === k ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700'}`}>
            {t(k === 'supply' ? 'pos.supply' : k === 'withdrawal' ? 'pos.withdrawal' : 'pos.cashRefundMove')}
          </button>
        ))}
      </div>
      <BigNumberInput id="mv-amount" label={t('pos.amount')} value={amount} onChange={setAmount} autoFocus />
      <div>
        <label htmlFor="mv-reason" className="block text-sm font-medium text-slate-600 mb-1">{t('pos.reason')}</label>
        <input id="mv-reason" value={reason} onChange={e => setReason(e.target.value)} className="field !py-3 text-base" />
      </div>
      <div>
        <label htmlFor="mv-who" className="block text-sm font-medium text-slate-600 mb-1">{t('pos.responsible')}</label>
        <input id="mv-who" value={who} onChange={e => setWho(e.target.value)} className="field !py-3 text-base" />
      </div>
    </Modal>
  );
}

const PLATFORMS = ['square', 'doordash', 'ubereats', 'grubhub', 'other'] as const;
export interface ReportValues {
  channel: string; sourceName: string | null; unit: string; opDate: string; includes: { channels?: string[]; payments?: Payment[] };
  grossSales: number; orders: number | null; discounts: number; refunds: number; fees: number; payout: number | null; payoutDate: string | null;
}

export function ReportDialog({ units, date, busy, onConfirm, onImportCsv, onZeroDay, onClose }: {
  units: string[]; date: string; busy: boolean; onClose: () => void; onConfirm: (v: ReportValues) => void; onImportCsv: () => void; onZeroDay: (unit: string, date: string) => void;
}) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<(typeof PLATFORMS)[number]>('doordash');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState(units[0] ?? '');
  const [d, setD] = useState(date);
  const [f, setF] = useState({ gross: '', orders: '', discounts: '', refunds: '', fees: '', payout: '', payoutDate: '' });
  const [inc, setInc] = useState<{ channels: string[]; payments: Payment[] }>({ channels: ['counter'], payments: ['card'] });
  const [review, setReview] = useState(false);
  const val = (k: keyof typeof f) => (f[k].trim() === '' ? 0 : n(f[k]));
  const values: ReportValues = {
    channel, sourceName: channel === 'other' ? name.trim() || null : null, unit, opDate: d,
    includes: channel === 'square' ? inc : {},
    grossSales: val('gross'), orders: f.orders.trim() === '' ? null : Math.round(n(f.orders)), discounts: val('discounts'), refunds: val('refunds'),
    fees: val('fees'), payout: f.payout.trim() === '' ? null : n(f.payout), payoutDate: f.payoutDate || null,
  };
  const valid = !Number.isNaN(values.grossSales) && f.gross.trim() !== '' && d && (channel !== 'other' || name.trim());
  const label = (c: string) => t(`day.channel.${c}`);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const field = (k: keyof typeof f, lbl: string, type = 'number') => (
    <div>
      <label htmlFor={`rp-${k}`} className="block text-xs font-medium text-slate-600 mb-1">{lbl}</label>
      <input id={`rp-${k}`} type={type} inputMode={type === 'number' ? 'decimal' : undefined} step="0.01" value={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} className="field !py-2.5 text-base" />
    </div>
  );
  return (
    <Modal title={t('pos.reportTitle')} onClose={onClose} wide footer={review ? <>
      <button onClick={() => setReview(false)} className="btn-secondary !py-3">{t('pos.back')}</button>
      <button onClick={() => onConfirm(values)} disabled={busy} className="btn-primary !py-3 !px-6 text-base"><CheckCircle2 size={18} /> {busy ? t('pos.saving') : t('pos.saveReport')}</button>
    </> : <>
      <button onClick={() => onZeroDay(unit, d)} className="btn-secondary !py-3 mr-auto">{t('pos.zeroDay')}</button>
      <button onClick={onImportCsv} className="btn-secondary !py-3"><FileSpreadsheet size={16} /> {t('pos.importCsv')}</button>
      <button onClick={() => setReview(true)} disabled={!valid} className="btn-primary !py-3 !px-6 text-base">{t('pos.reviewTitle')}</button>
    </>}>
      {!review ? (
        <>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pos.platform')}>
            {PLATFORMS.map(p => (
              <button key={p} type="button" role="radio" aria-checked={channel === p} onClick={() => setChannel(p)}
                className={`rounded-2xl border-2 px-4 py-2.5 font-semibold ${channel === p ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700'}`}>
                {p === 'other' ? t('pos.otherPlatform') : label(p)}
              </button>
            ))}
          </div>
          {channel === 'other' && <div><label htmlFor="rp-name" className="block text-xs font-medium text-slate-600 mb-1">{t('pos.platformName')}</label><input id="rp-name" value={name} onChange={e => setName(e.target.value)} className="field !py-2.5 text-base" /></div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {units.length > 1 && (
              <div>
                <label htmlFor="rp-unit" className="block text-xs font-medium text-slate-600 mb-1">{t('pos.unit')}</label>
                <select id="rp-unit" value={unit} onChange={e => setUnit(e.target.value)} className="field !py-2.5 text-base">{units.map(u => <option key={u} value={u}>{u || t('pos.mainUnit')}</option>)}</select>
              </div>
            )}
            <div><label htmlFor="rp-date" className="block text-xs font-medium text-slate-600 mb-1">{t('pos.saleDate')}</label><input id="rp-date" type="date" value={d} onChange={e => setD(e.target.value)} className="field !py-2.5 text-base" /></div>
            {field('gross', t('pos.gross'))}
            {field('orders', `${t('pos.orders')} (${t('pos.optional')})`)}
            {field('discounts', t('pos.discounts'))}
            {field('refunds', t('pos.refunds'))}
            {field('fees', t('pos.fees'))}
            {field('payout', `${t('pos.payout')} (${t('pos.optional')})`)}
            {field('payoutDate', `${t('pos.payoutDate')} (${t('pos.optional')})`, 'date')}
          </div>
          {channel === 'square' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="font-semibold text-amber-900 text-sm">{t('pos.includesTitle')}</p>
              <p className="text-xs text-amber-900">{t('pos.includesHint')}</p>
              <div className="flex flex-wrap gap-2 items-center"><span className="text-xs text-slate-600 w-28">{t('pos.channelsInc')}</span>
                {['counter', 'direct', 'doordash', 'ubereats', 'grubhub'].map(c => <label key={c} className="inline-flex items-center gap-1.5 text-sm bg-white rounded-lg px-2 py-1.5 border border-amber-200"><input type="checkbox" checked={inc.channels.includes(c)} onChange={() => setInc(x => ({ ...x, channels: toggle(x.channels, c) }))} className="w-4 h-4 accent-blue-600" /> {label(c)}</label>)}
              </div>
              <div className="flex flex-wrap gap-2 items-center"><span className="text-xs text-slate-600 w-28">{t('pos.paymentsInc')}</span>
                {(['cash', 'card', 'online', 'other'] as Payment[]).map(p => <label key={p} className="inline-flex items-center gap-1.5 text-sm bg-white rounded-lg px-2 py-1.5 border border-amber-200"><input type="checkbox" checked={inc.payments.includes(p)} onChange={() => setInc(x => ({ ...x, payments: toggle(x.payments, p) }))} className="w-4 h-4 accent-blue-600" /> {t(`day.payment.${p}`)}</label>)}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2 text-base" data-testid="report-review">
          <p><b>{channel === 'other' ? name : label(channel)}</b> · {unit || t('pos.mainUnit')} · {new Date(`${d}T12:00:00`).toLocaleDateString()}</p>
          <dl className="grid grid-cols-2 gap-2">
            {([['gross', values.grossSales], ['discounts', values.discounts], ['refunds', values.refunds], ['fees', values.fees]] as const).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 px-3 py-2"><dt className="text-xs text-slate-500">{t(`pos.${k}`)}</dt><dd className="font-mono font-semibold">{formatCurrency(v)}</dd></div>
            ))}
            <div className="rounded-xl bg-navy-900 text-white px-3 py-2 col-span-2"><dt className="text-xs text-blue-200">{t('pos.net')}</dt><dd className="font-mono font-bold text-xl">{formatCurrency(values.grossSales - values.discounts - values.refunds)}</dd></div>
            {values.orders !== null && <div className="rounded-xl bg-slate-50 px-3 py-2"><dt className="text-xs text-slate-500">{t('pos.orders')}</dt><dd className="font-mono font-semibold">{values.orders}</dd></div>}
            {values.payout !== null && <div className="rounded-xl bg-slate-50 px-3 py-2"><dt className="text-xs text-slate-500">{t('pos.payout')}</dt><dd className="font-mono font-semibold">{formatCurrency(values.payout)}{values.payoutDate ? ` · ${values.payoutDate}` : ''}</dd></div>}
          </dl>
        </div>
      )}
    </Modal>
  );
}

export function CloseDialog({ expected, breakdown, busy, onConfirm, onClose }: {
  expected: number; breakdown: { opening: number; sales: number; supply: number; withdrawal: number; refunds: number }; busy: boolean; onClose: () => void; onConfirm: (counted: number) => void;
}) {
  const { t } = useTranslation();
  const [counted, setCounted] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const c = n(counted);
  const diff = Math.round((c - expected) * 100) / 100;
  const res = cashResult(diff);
  return (
    <Modal title={t('pos.closeTitle')} onClose={onClose} footer={step === 1 ? <>
      <button onClick={onClose} className="btn-secondary !py-3">{t('pos.back')}</button>
      <button onClick={() => setStep(2)} disabled={Number.isNaN(c) || c < 0} className="btn-primary !py-3 !px-6 text-base">{t('pos.next')}</button>
    </> : <>
      <button onClick={() => setStep(1)} className="btn-secondary !py-3">{t('pos.back')}</button>
      <button onClick={() => onConfirm(c)} disabled={busy} className="btn-primary !py-3 !px-6 text-base">{busy ? t('pos.saving') : t('pos.confirmClose')}</button>
    </>}>
      {step === 1 ? (
        <>
          <p className="text-slate-700">{t('pos.step1')}</p>
          <BigNumberInput id="close-counted" label={t('pos.counted')} value={counted} onChange={setCounted} autoFocus />
        </>
      ) : (
        <div className="space-y-3" data-testid="close-compare">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{t('pos.counted')}</dt><dd className="font-mono font-bold text-lg">{formatCurrency(c)}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{t('pos.expected')}</dt><dd className="font-mono font-bold text-lg">{formatCurrency(expected)}</dd></div>
            <div className={`rounded-2xl p-3 ${res === 'ok' ? 'bg-emerald-100 text-emerald-900' : res === 'short' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}><dt className="text-xs">{t('pos.difference')}</dt><dd className="font-mono font-bold text-lg">{formatCurrency(diff)}</dd></div>
          </dl>
          <p className={`text-xl font-bold flex items-center gap-2 ${res === 'ok' ? 'text-emerald-700' : res === 'short' ? 'text-red-700' : 'text-amber-700'}`} role="status">
            {res === 'ok' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            {res === 'ok' ? t('pos.ok') : res === 'short' ? t('pos.short', { v: formatCurrency(-diff) }) : t('pos.over', { v: formatCurrency(diff) })}
          </p>
          <ul className="text-sm text-slate-600 space-y-0.5">
            {(Object.keys(breakdown) as (keyof typeof breakdown)[]).map(k => <li key={k} className="flex justify-between"><span>{t(`pos.breakdown.${k}`)}</span><span className="font-mono">{k === 'withdrawal' || k === 'refunds' ? '−' : ''}{formatCurrency(breakdown[k])}</span></li>)}
          </ul>
          <p className="text-xs text-slate-500">{t('pos.formula')}</p>
          <p className="text-xs text-blue-900 bg-blue-50 rounded-lg px-3 py-2">{t('pos.pendingNote')}</p>
        </div>
      )}
    </Modal>
  );
}
