import type { SalesRecord } from './normalize';

// Conciliação Square × plataforma de delivery.
// - Correspondência confiável: mesmo nº de pedido, valor próximo e data próxima → 'matched'.
//   A venda passa a contar só no canal da plataforma (o extrato dela é a fonte de taxas e repasses).
// - Nº igual mas valor/data divergentes, ou só valor+data+origem parecidos → 'review'.
// - Decisões manuais ('distinct' ou 'matched') são preservadas.

const DELIVERY = new Set(['doordash', 'ubereats', 'grubhub']);
const normId = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const dayDiff = (a?: string | null, b?: string | null) =>
  a && b ? Math.abs((Date.parse(a) - Date.parse(b)) / 86400000) : Infinity;
const amountClose = (a: number, b: number, pct: number, min: number) => Math.abs(a - b) <= Math.max(min, Math.abs(b) * pct);

export interface ReconcileResult { updates: SalesRecord[]; matched: number; review: number }

export function reconcile(square: SalesRecord[], delivery: SalesRecord[]): ReconcileResult {
  const updates = new Map<string, SalesRecord>();
  const put = (r: SalesRecord) => updates.set(`${r.source}|${r.recordKey}`, r);
  let matched = 0, review = 0;
  const orders = delivery.filter(d => d.kind === 'order' && DELIVERY.has(d.source));
  const byId = new Map<string, SalesRecord[]>();
  for (const d of orders) {
    const k = normId(d.externalOrderId);
    if (k.length >= 4) byId.set(k, [...(byId.get(k) ?? []), d]);
  }
  const takenDelivery = new Set<string>();

  for (const s of square) {
    if (s.kind !== 'order') continue;
    if (s.matchStatus === 'distinct' || (s.matchStatus === 'matched' && s.matchedKey)) {
      if (s.matchedKey) takenDelivery.add(`${s.matchedSource}|${s.matchedKey}`);
      continue;
    }
    const ref = normId(s.externalRef);
    const idHits = ref.length >= 4 ? (byId.get(ref) ?? []) : [];
    let decided: { d: SalesRecord; status: 'matched' | 'review' } | null = null;
    if (idHits.length === 1) {
      const d = idHits[0];
      const ok = amountClose(s.netSales, d.netSales, 0.02, 0.5) && dayDiff(s.saleDate, d.saleDate) <= 1;
      decided = { d, status: ok ? 'matched' : 'review' };
    } else if (idHits.length > 1) {
      decided = { d: idHits[0], status: 'review' };
    } else if (DELIVERY.has(s.channel)) {
      // Sem nº correspondente: só sugere quando origem, data e valor coincidem — nunca concilia sozinho.
      const cand = orders.filter(d => d.source === s.channel && !takenDelivery.has(`${d.source}|${d.recordKey}`)
        && dayDiff(s.saleDate, d.saleDate) === 0 && amountClose(s.netSales, d.netSales, 0.01, 0.05));
      if (cand.length >= 1) decided = { d: cand[0], status: 'review' };
    }
    if (!decided) {
      if (s.matchStatus !== 'none') put({ ...s, matchStatus: 'none', matchedSource: null, matchedKey: null });
      continue;
    }
    const { d, status } = decided;
    takenDelivery.add(`${d.source}|${d.recordKey}`);
    if (status === 'matched') matched++; else review++;
    put({ ...s, matchStatus: status, matchedSource: d.source, matchedKey: d.recordKey });
    put({ ...d, matchStatus: status, matchedSource: 'square', matchedKey: s.recordKey });
  }
  return { updates: [...updates.values()], matched, review };
}

// Registro do Square conciliado com a plataforma não entra nos totais (a venda conta pelo extrato da
// plataforma). Em revisão também fica fora até a decisão, para nunca contar a mesma venda duas vezes.
export const countsInTotals = (r: SalesRecord) => !(r.source === 'square' && (r.matchStatus === 'matched' || r.matchStatus === 'review'));
