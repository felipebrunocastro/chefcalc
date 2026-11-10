import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRestaurant } from '../../hooks/useRestaurant';
import { loadPos, type PosData } from '../../data/posRepo';
import { getSalesRecords } from '../../data/importsRepo';
import { buildLines, monthLayer, salesAsRecords, type ConsolidateInput } from '../../lib/pos/consolidate';
import type { FinanceMonth } from '../../types';
import type { SalesRecord } from '../../lib/imports/normalize';
import { opDate } from '../../lib/pos/cash';
import { reconcile } from '../../lib/imports/reconcile';

const EMPTY: PosData = { sessions: [], sales: [], events: [], movements: [], summaries: [], products: [] };

export function usePos() {
  const { current, checkAccess } = useRestaurant();
  const rid = current?.id;
  const [data, setData] = useState<PosData>(EMPTY);
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!rid) return;
    try {
      const [d, r] = await Promise.all([loadPos(rid), getSalesRecords(rid).catch(() => [] as SalesRecord[])]);
      setData(d); setRecords(r); setError(null);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [rid]);
  useEffect(() => { setLoading(true); reload(); }, [reload]);

  // Toda escrita passa por aqui: em erro, confere se o acesso foi revogado.
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try { const r = await fn(); await reload(); return r; }
    catch (e) { await checkAccess(); throw e; }
  }, [reload, checkAccess]);

  const profile = current?.profile ?? {};
  const tz = profile.timezone || undefined;
  const today = opDate(new Date(), tz);
  const units = useMemo(() => {
    if (current?.memberUnit) return [current.memberUnit];
    const set = new Set<string>([...(profile.pos?.units ?? []), profile.unitName ?? '', ...data.sessions.map(s => s.unit)].filter(u => u !== undefined));
    const list = [...set].filter(Boolean);
    return list.length ? list : [''];
  }, [current?.memberUnit, profile.pos?.units, profile.unitName, data.sessions]);
  const expectedChannels = useMemo(() => (profile.delivery ?? []).filter(d => d.active).map(d => d.id), [profile.delivery]);
  const cashRecords0 = useMemo(() => salesAsRecords(data.sales), [data.sales]);
  // Correspondências confiáveis (mesmo nº de pedido, valor e data) entram nos totais na hora;
  // casos incertos ficam em revisão e fora da soma até a decisão.
  const reconciled = useMemo(() => {
    const square = records.filter(r => r.source === 'square');
    if (!square.length) return records;
    const res = reconcile(square, [...records.filter(r => r.source !== 'square'), ...cashRecords0]);
    if (!res.updates.length) return records;
    const upd = new Map(res.updates.filter(u => u.source !== 'chefcalc').map(u => [`${u.source}|${u.recordKey}`, u] as const));
    return records.map(r => upd.get(`${r.source}|${r.recordKey}`) ?? r);
  }, [records, cashRecords0]);
  const input: ConsolidateInput = useMemo(() => ({ ...data, records: reconciled, expectedChannels }), [data, reconciled, expectedChannels]);
  const built = useMemo(() => buildLines(input), [input]);
  const cashRecords = cashRecords0;

  return { rid, data, records, loading, error, reload, run, today, tz, units, input, built, cashRecords };
}

// Meses do Financeiro com a camada de vendas vinda da base consolidada (caixa + relatórios + importações).
// Valores digitados manualmente continuam valendo (ver monthSalesByChannel).
export function useLiveMonths(months: FinanceMonth[]): FinanceMonth[] {
  const { current } = useRestaurant();
  const pos = usePos();
  return useMemo(() => {
    if (!current) return months;
    const periods = new Set([...months.map(m => m.period), ...pos.built.lines.map(l => (l.date || l.payoutDate || '').slice(0, 7)).filter(Boolean)]);
    return [...periods].sort().reverse().map(p => {
      const base = months.find(m => m.period === p) ?? { restaurantId: current.id, period: p, status: 'open' as const, estimateSnapshot: null, entries: [] };
      const live = monthLayer(p, pos.input, pos.built);
      if (!live.recordCount && !Object.keys(live.payouts).length) return base;
      return { ...base, sales: { ...(base.sales ?? {}), imported: { channels: live.channels, fees: live.fees, payouts: live.payouts, appliedAt: new Date().toISOString(), recordCount: live.recordCount } } };
    });
  }, [months, pos.built, pos.input, current]);
}
