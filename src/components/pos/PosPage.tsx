import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, ShoppingCart, ArrowLeftRight, FileText, Lock, CalendarDays, Store, ChevronLeft, CheckCircle2, Undo2, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { formatCurrency } from '../../lib/currency';
import { expectedCash } from '../../lib/pos/cash';
import { dayResult } from '../../lib/pos/consolidate';
import { reconcile } from '../../lib/imports/reconcile';
import { addMovement, addSummary, closeSession, correctSession, openSession, recordSale, saleEvent, updateSummary } from '../../data/posRepo';
import { getBatches, lastMapping, saveBatch, upsertSalesRecords, type ImportBatch } from '../../data/importsRepo';
import { salesChannels } from '../../utils/breakeven';
import { usePos } from './usePos';
import { SellScreen } from './SellScreen';
import { CalendarView } from './CalendarView';
import { DayDetail, type DayActions } from './DayDetail';
import { CatalogManager } from './CatalogManager';
import { OpenDialog, MovementDialog, ReportDialog, CloseDialog } from './PosDialogs';
import { Modal } from './Modal';
import { Mascot } from '../ui/Mascot';
import { ImportWizard, type WizardResult } from '../integrations/ImportWizard';
import type { PosSale } from '../../lib/pos/types';

type Screen = 'home' | 'sell' | 'calendar' | 'catalog' | 'day';
type DialogKind = 'open' | 'move' | 'report' | 'close' | 'csv' | 'correct' | null;
const UNIT_KEY = 'chefcalc:posUnit';

export function PosPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { current } = useRestaurant();
  const pos = usePos();
  const [screen, setScreen] = useState<Screen>('home');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [saleAction, setSaleAction] = useState<{ sale: PosSale; kind: 'cancel' | 'refund' } | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [unit, setUnitState] = useState<string>(() => sessionStorage.getItem(UNIT_KEY) ?? '');
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  if (!current || !pos.rid) return null;
  if (pos.error && !pos.loading) return (
    <div className="card p-5 border-amber-300 bg-amber-50 text-amber-900 text-sm space-y-1" role="alert">
      <p className="font-medium">{t('pos.loadFailed')}</p><p>{t('pos.setupHint')}</p><p className="text-xs opacity-70">{pos.error}</p>
      <button onClick={() => pos.reload()} className="btn-secondary mt-2">{t('pos.retry')}</button>
    </div>
  );
  const rid = pos.rid;
  const isOwner = current.role === 'owner';
  const canOperate = isOwner || current.role === 'operator';
  const units = pos.units;
  const workUnit = units.includes(unit) ? unit : units.length === 1 ? units[0] : null;
  const setUnit = (u: string) => { sessionStorage.setItem(UNIT_KEY, u); setUnitState(u); };
  const session = pos.data.sessions.find(s => s.status === 'open' && s.unit === (workUnit ?? ''));
  const opDate = session?.opDate ?? pos.today;
  const sessionSales = session ? pos.data.sales.filter(s => s.sessionId === session.id) : [];
  const sessionMoves = session ? pos.data.movements.filter(m => m.sessionId === session.id) : [];
  const exp = session ? expectedCash(session, pos.data.sales, pos.data.movements, pos.data.events) : 0;
  const breakdown = session ? {
    opening: session.openingCash,
    sales: sessionSales.filter(s => s.status === 'completed').reduce((a, s) => a + s.total, 0),
    supply: sessionMoves.filter(m => m.kind === 'supply').reduce((a, m) => a + m.amount, 0),
    withdrawal: sessionMoves.filter(m => m.kind === 'withdrawal').reduce((a, m) => a + m.amount, 0),
    refunds: sessionMoves.filter(m => m.kind === 'refund').reduce((a, m) => a + m.amount, 0) + pos.data.events.filter(e => e.sessionId === session.id && e.kind === 'refund' && e.cash).reduce((a, e) => a + e.amount, 0),
  } : { opening: 0, sales: 0, supply: 0, withdrawal: 0, refunds: 0 };
  const today = dayResult(opDate, pos.input, pos.built, workUnit !== null && units.length > 1 ? { unit: workUnit } : {});
  const lastClosed = [...pos.data.sessions].filter(s => s.status === 'closed' && s.unit === (workUnit ?? '')).sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))[0];
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '');
  const responsible = user?.email?.split('@')[0] ?? '';

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await pos.run(fn); if (ok) setNotice({ ok: true, text: ok }); setDialog(null); return true; }
    catch (e) { setNotice({ ok: false, text: t('pos.error', { msg: (e as Error).message }) }); return false; }
    finally { setBusy(false); }
  };

  const runReconcile = async () => {
    const square = pos.records.filter(r => r.source === 'square');
    const others = [...pos.records.filter(r => r.source !== 'square'), ...pos.cashRecords];
    const res = reconcile(square, others);
    const updates = res.updates.filter(u => u.source !== 'chefcalc');
    if (updates.length) await upsertSalesRecords(rid, updates);
    return res;
  };

  const dayActions: DayActions = {
    canOperate,
    resolveDetailed: async (id, keep) => { await act(() => updateSummary(id, { status: keep ? 'kept' : 'replaced' }, keep ? 'keep summary' : 'replaced by detailed report')); },
    resolveOverlap: async (id, how) => { await act(() => updateSummary(id, { overlapResolution: how }, `overlap: ${how}`)); },
    reconcile: async () => { let r = { matched: 0, review: 0 }; await act(async () => { r = await runReconcile(); }); setNotice({ ok: true, text: t('day.reconciled', r) }); },
  };

  const onImport = async (w: WizardResult) => {
    const prev = new Map(pos.records.filter(r => r.source === w.batch.source).map(r => [r.recordKey, r] as const));
    const recs = w.records.map(r => { const p = prev.get(r.recordKey); return p ? { ...r, matchStatus: p.matchStatus, matchedSource: p.matchedSource, matchedKey: p.matchedKey } : r; });
    await pos.run(async () => {
      const batchId = await saveBatch(rid, w.batch, w.existingBatchId);
      await upsertSalesRecords(rid, recs, batchId);
    });
    await runReconcile(); await pos.reload();
    setDialog(null);
    setNotice({ ok: true, text: t('integ.imported', w.diff) });
  };

  const Tile = ({ icon: Icon, label, onClick, primary = false, disabled = false, testid }: { icon: typeof Banknote; label: string; onClick: () => void; primary?: boolean; disabled?: boolean; testid?: string }) => (
    <button onClick={onClick} disabled={disabled} data-testid={testid}
      className={`rounded-3xl p-5 min-h-[7.5rem] flex flex-col items-start justify-between text-left font-bold text-lg shadow-sm disabled:opacity-40 active:scale-[0.99] ${primary ? 'bg-blue-600 text-white hover:bg-blue-700 sm:col-span-2' : 'bg-white border-2 border-blue-100 text-navy-900 hover:border-blue-400'}`}>
      <Icon size={28} aria-hidden="true" /> {label}
    </button>
  );

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Cabeçalho do caixa: restaurante, unidade, data operacional e estado */}
      <div className="sticky top-14 lg:top-[6.5rem] z-30 -mx-3 md:mx-0 px-3 md:px-4 py-2.5 bg-white/95 backdrop-blur border-y md:border md:rounded-2xl border-blue-100 flex flex-wrap items-center gap-x-4 gap-y-1">
        {screen !== 'home' && <button onClick={() => setScreen('home')} className="btn-secondary !py-2"><ChevronLeft size={18} /> {t('pos.back')}</button>}
        <span className="font-bold text-navy-900">{current.name}</span>
        {units.length > 1 && !current.memberUnit ? (
          <select aria-label={t('pos.unit')} value={workUnit ?? ''} onChange={e => setUnit(e.target.value)} className="field !w-auto !py-1.5">
            {!workUnit && <option value="">{t('pos.chooseUnit')}</option>}
            {units.map(u => <option key={u} value={u}>{u || t('pos.mainUnit')}</option>)}
          </select>
        ) : (workUnit && <span className="text-sm text-slate-600">{t('pos.unit')}: <b>{workUnit}</b></span>)}
        <span className="text-sm text-slate-600">{t('pos.opDate')}: <b>{new Date(`${opDate}T12:00:00`).toLocaleDateString(locale)}</b></span>
        <span className={`ml-auto text-sm font-bold rounded-full px-3 py-1 ${session ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`} data-testid="session-state">
          {session ? `${t('pos.sessionOpen')} · ${session.shift}` : t('pos.sessionClosed')}
        </span>
      </div>

      {notice && (
        <p className={`rounded-2xl px-4 py-3 font-medium flex items-center gap-2 ${notice.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-red-50 border border-red-200 text-red-900'}`} role="status">
          {notice.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {notice.text}
          <button onClick={() => setNotice(null)} className="ml-auto btn-ghost !p-1" aria-label={t('pos.closeDialog')}>✕</button>
        </p>
      )}

      {workUnit === null && screen === 'home' && (
        <div className="rounded-3xl bg-white border border-blue-100 p-6 space-y-3">
          <h2 className="text-xl font-bold text-navy-900">{t('pos.chooseUnit')}</h2>
          <div className="grid sm:grid-cols-3 gap-3">{units.map(u => <button key={u} onClick={() => setUnit(u)} className="rounded-2xl border-2 border-blue-100 hover:border-blue-500 p-5 text-left font-bold text-lg">{u || t('pos.mainUnit')}</button>)}</div>
          {screen === 'home' && <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => setScreen('calendar')} className="btn-secondary !py-2.5"><CalendarDays size={16} /> {t('pos.viewCalendar')}</button>
            {isOwner && <button onClick={() => setScreen('catalog')} className="btn-secondary !py-2.5"><Store size={16} /> {t('pos.catalog')}</button>}
          </div>}
        </div>
      )}

      {workUnit !== null && screen === 'home' && (
        <>
          <div className="flex items-center gap-3">
            <Mascot variant="finance" size={64} decorative className="shrink-0 -my-2" />
            <h1 className="text-2xl font-bold text-navy-900">{t('pos.title')}</h1>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {session ? <>
              <Tile icon={ShoppingCart} label={t('pos.sell')} onClick={() => setScreen('sell')} primary testid="tile-sell" />
              <Tile icon={ArrowLeftRight} label={t('pos.move')} onClick={() => setDialog('move')} disabled={!canOperate} />
              <Tile icon={Lock} label={t('pos.close')} onClick={() => setDialog('close')} disabled={!canOperate} />
            </> : (
              <Tile icon={Banknote} label={t('pos.open')} onClick={() => setDialog('open')} primary disabled={!canOperate} testid="tile-open" />
            )}
            <Tile icon={FileText} label={t('pos.report')} onClick={() => setDialog('report')} disabled={!canOperate} />
            <Tile icon={CalendarDays} label={t('pos.viewCalendar')} onClick={() => setScreen('calendar')} />
            {isOwner && <Tile icon={Store} label={t('pos.catalog')} onClick={() => setScreen('catalog')} />}
          </div>

          {session && (
            <section className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white border border-blue-100 p-4"><div className="text-sm text-slate-500">{t('pos.todaySales')}</div><div className="font-mono font-extrabold text-3xl text-navy-900" data-testid="shift-sales">{formatCurrency(breakdown.sales)}</div><div className="text-sm text-slate-500">{t('pos.salesCount', { n: sessionSales.filter(s => s.status === 'completed').length })}</div></div>
              {/* Contagem às cegas: o operador só vê o esperado depois de informar o contado no fechamento. */}
              {isOwner && <div className="rounded-2xl bg-white border border-blue-100 p-4"><div className="text-sm text-slate-500">{t('pos.expectedNow')}</div><div className="font-mono font-extrabold text-3xl text-navy-900">{formatCurrency(exp)}</div></div>}
              <div className="rounded-2xl bg-white border border-blue-100 p-4 text-sm text-slate-600">{t('pos.openedAt', { time: time(session.openedAt), who: session.responsible })}<br />{t('pos.openingCash')}: <b className="font-mono">{formatCurrency(session.openingCash)}</b></div>
            </section>
          )}
          {!session && lastClosed && lastClosed.opDate === pos.today && (
            <p className="rounded-2xl bg-white border border-blue-100 px-4 py-3 text-sm flex flex-wrap gap-3 items-center">
              <Lock size={16} /> {t('pos.closedMsg', { v: formatCurrency(lastClosed.countedCash ?? 0) })} · {t('pos.closedBy', { time: time(lastClosed.closedAt) })}
              {canOperate && <button onClick={() => setDialog('correct')} className="btn-secondary !py-1.5 ml-auto">{t('pos.correct')}</button>}
            </p>
          )}

          <section className="rounded-3xl bg-white border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-3"><h2 className="font-bold text-navy-900">{t('day.title')}</h2>
              <button onClick={() => setScreen('day')} className="ml-auto text-sm text-blue-700 underline">{t('cal.openDay')}</button></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[...new Set(['counter', ...salesChannels(current.profile).filter(c => c.delivery).map(c => c.id), ...Object.keys(today.byChannel)])].map(c => {
                const v = today.byChannel[c];
                const pending = today.pendingChannels.includes(c);
                return (
                  <div key={c} className={`rounded-2xl border-2 p-3 ${v ? 'border-emerald-200' : pending ? 'border-dashed border-amber-300 bg-amber-50' : 'border-slate-100'}`} data-testid={`channel-card-${c}`}>
                    <div className="text-sm font-semibold text-navy-900">{t(`day.channel.${c}`, c)}</div>
                    <div className="font-mono font-bold text-lg">{v ? formatCurrency(v.net) : '—'}</div>
                    <div className={`text-[11px] font-semibold ${v ? 'text-emerald-700' : 'text-amber-800'}`}>{v ? `${t('day.registered')} · ${v.sources.map(s => t(`day.origin.${s}`)).join(', ')}` : t('day.pending')}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-sm">
              <span className={`rounded-full px-3 py-1 font-semibold ${today.physicalClosed ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}>{today.physicalClosed ? t('pos.physicalClosed') : t('pos.physicalOpen')}</span>
              <span className={`rounded-full px-3 py-1 font-semibold ${today.consolidated ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{today.consolidated ? t('pos.consolidated') : t('pos.notConsolidated')}</span>
              <span className="ml-auto font-semibold">{t('day.net')}: <b className="font-mono">{formatCurrency(today.net)}</b></span>
            </div>
          </section>

          {session && sessionSales.length > 0 && (
            <section className="rounded-3xl bg-white border border-blue-100 p-4">
              <h2 className="font-bold text-navy-900 mb-2">{t('pos.recent')}</h2>
              <ul className="divide-y divide-slate-100">
                {[...sessionSales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15).map(s => {
                  const refunded = pos.data.events.filter(e => e.saleId === s.id && e.kind === 'refund').reduce((a, e) => a + e.amount, 0);
                  return (
                    <li key={s.id} className={`py-2 flex flex-wrap items-center gap-2 ${s.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}>
                      <span className="font-mono text-sm w-24">{s.code}</span>
                      <span className="text-sm text-slate-600 flex-1 min-w-[8rem] truncate">{s.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</span>
                      {refunded > 0 && <span className="text-xs text-amber-800">{t('pos.refunded', { v: formatCurrency(refunded) })}</span>}
                      <span className="font-mono font-semibold">{formatCurrency(s.total)}</span>
                      {s.status === 'completed' && canOperate && <>
                        <button onClick={() => setSaleAction({ sale: s, kind: 'cancel' })} className="btn-secondary !py-1.5 !px-2 text-xs"><XCircle size={14} /> {t('pos.cancelSale')}</button>
                        <button onClick={() => setSaleAction({ sale: s, kind: 'refund' })} className="btn-secondary !py-1.5 !px-2 text-xs"><Undo2 size={14} /> {t('pos.refund')}</button>
                      </>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {workUnit !== null && screen === 'sell' && (session ? (
        <SellScreen
          products={pos.data.products} sales={pos.data.sales} sessionId={session.id} opDate={session.opDate}
          defaultTaxPct={current.profile.pos?.taxPct ?? 0} maxDiscountPct={current.profile.pos?.maxDiscountPct ?? 10} isOwner={isOwner}
          onSubmit={v => pos.run(() => recordSale(rid, v))}
        />
      ) : <button onClick={() => setDialog('open')} className="btn-primary !py-4 !px-8 text-lg">{t('pos.open')}</button>)}

      {screen === 'calendar' && <CalendarView input={pos.input} built={pos.built} units={units} today={pos.today} actions={dayActions} />}
      {screen === 'day' && <DayDetail result={today} input={pos.input} actions={dayActions} />}
      {screen === 'catalog' && isOwner && <CatalogManager products={pos.data.products} onChanged={pos.reload} />}

      {dialog === 'open' && workUnit !== null && (
        <OpenDialog units={[workUnit]} defaultResponsible={responsible} busy={busy} onClose={() => setDialog(null)}
          onConfirm={v => act(() => openSession(rid, { ...v, opDate: pos.today }))} />
      )}
      {dialog === 'move' && session && (
        <MovementDialog busy={busy} responsible={session.responsible} onClose={() => setDialog(null)}
          onConfirm={v => act(() => addMovement(rid, { sessionId: session.id, ...v }), t('pos.savedOk'))} />
      )}
      {dialog === 'report' && (
        <ReportDialog units={workUnit !== null ? [workUnit, ...units.filter(u => u !== workUnit)] : units} date={opDate} busy={busy} onClose={() => setDialog(null)}
          onConfirm={v => act(() => addSummary(rid, v), t('pos.reportSaved', { channel: v.sourceName || t(`day.channel.${v.channel}`) }))}
          onZeroDay={(u, d) => act(() => addSummary(rid, { unit: u, opDate: d, channel: '__day__', sourceName: null, includes: {}, grossSales: 0, orders: 0, discounts: 0, refunds: 0, fees: 0, payout: null, payoutDate: null }), t('cal.status.zero'))}
          onImportCsv={async () => { setBatches(await getBatches(rid).catch(() => [])); setDialog('csv'); }} />
      )}
      {dialog === 'csv' && (
        <ImportWizard initialSource="doordash" channels={salesChannels(current.profile).map(c => ({ id: c.id, label: t(`day.channel.${c.id}`, c.name || c.id) }))}
          units={units.filter(Boolean)} existing={pos.records} batches={batches} savedMapping={src => lastMapping(rid, src)} onConfirm={onImport} onClose={() => setDialog(null)} />
      )}
      {dialog === 'close' && session && (
        <CloseDialog expected={exp} breakdown={breakdown} busy={busy} onClose={() => setDialog(null)}
          onConfirm={async counted => { if (await act(() => closeSession(session.id, counted))) setNotice({ ok: true, text: t('pos.closedMsg', { v: formatCurrency(counted) }) }); }} />
      )}
      {dialog === 'correct' && lastClosed && <CorrectDialog current={lastClosed.countedCash ?? 0} busy={busy} onClose={() => setDialog(null)} onConfirm={(v, r) => act(() => correctSession(lastClosed.id, v, r), t('pos.savedOk'))} />}
      {saleAction && (
        <SaleActionDialog kind={saleAction.kind} sale={saleAction.sale} busy={busy} hasOpenSession={!!session} onClose={() => setSaleAction(null)}
          onConfirm={async (amount, reason, cash) => {
            if (await act(() => saleEvent(rid, { saleId: saleAction.sale.id, kind: saleAction.kind, amount, cash, sessionId: cash ? session?.id ?? null : null, reason, responsible: session?.responsible ?? responsible }), t('pos.savedOk'))) setSaleAction(null);
          }} />
      )}
    </div>
  );
}

function CorrectDialog({ current, busy, onConfirm, onClose }: { current: number; busy: boolean; onConfirm: (v: number, reason: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState(String(current));
  const [reason, setReason] = useState('');
  return (
    <Modal title={t('pos.correct')} onClose={onClose} footer={<button onClick={() => onConfirm(Number(v), reason.trim())} disabled={busy || !reason.trim() || v.trim() === ''} className="btn-primary !py-3 !px-6">{t('pos.confirmAction')}</button>}>
      <label htmlFor="cr-v" className="label">{t('pos.counted')}</label><input id="cr-v" type="number" step="0.01" value={v} onChange={e => setV(e.target.value)} className="field !py-3 text-lg font-mono" />
      <label htmlFor="cr-r" className="label">{t('pos.correctReason')}</label><input id="cr-r" value={reason} onChange={e => setReason(e.target.value)} className="field !py-3" />
    </Modal>
  );
}

function SaleActionDialog({ kind, sale, busy, hasOpenSession, onConfirm, onClose }: { kind: 'cancel' | 'refund'; sale: PosSale; busy: boolean; hasOpenSession: boolean; onConfirm: (amount: number, reason: string, cash: boolean) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(sale.total));
  const [reason, setReason] = useState('');
  const [cash, setCash] = useState(hasOpenSession);
  const ok = reason.trim() && (kind === 'cancel' || Number(amount) > 0);
  return (
    <Modal title={`${kind === 'cancel' ? t('pos.cancelSale') : t('pos.refund')} · ${sale.code}`} onClose={onClose}
      footer={<button onClick={() => ok && onConfirm(Number(amount), reason.trim(), kind === 'refund' && cash)} disabled={!ok || busy} className="btn-primary !py-3 !px-6">{busy ? t('pos.saving') : t('pos.confirmAction')}</button>}>
      <p className="text-sm text-slate-600">{sale.items.map(i => `${i.qty}× ${i.name}`).join(', ')} · <b className="font-mono">{formatCurrency(sale.total)}</b></p>
      {kind === 'refund' && <>
        <label htmlFor="sa-amt" className="label">{t('pos.amount')}</label><input id="sa-amt" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="field !py-3 text-lg font-mono" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cash} disabled={!hasOpenSession} onChange={e => setCash(e.target.checked)} className="w-5 h-5 accent-blue-600" /> {t('pos.cashRefund')}</label>
      </>}
      <label htmlFor="sa-reason" className="label">{t('pos.reason')}</label><input id="sa-reason" value={reason} onChange={e => setReason(e.target.value)} className="field !py-3" />
    </Modal>
  );
}
