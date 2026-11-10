import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyze, diffExisting, parseCsv, parseMoney, parseDate, detectDateOrder, type SalesRecord } from '../lib/imports/normalize';
import { reconcile, countsInTotals } from '../lib/imports/reconcile';
import { summarizeMonth } from '../lib/imports/aggregate';
import { normalizeSquareOrder, normalizeSquarePayout, feesByOrder } from '../../supabase/functions/_shared/square.ts';

const csv = readFileSync(new URL('./fixtures/doordash-oct.csv', import.meta.url), 'utf8');
const dd = () => analyze(parseCsv(csv), { source: 'doordash', channel: 'doordash' });

describe('importação CSV — DoorDash', () => {
  it('detecta colunas, unidade, período e normaliza (taxas negativas no arquivo)', () => {
    const a = dd();
    expect(a.issues.filter(i => i.blocking)).toEqual([]);
    expect(a.units).toEqual(['Bistro Azul - Brickell']);
    expect(a.period).toEqual({ start: '2026-10-05', end: '2026-10-31' });
    expect(a.flipped).toContain('commissions');
    const first = a.records[0];
    expect(first).toMatchObject({ kind: 'order', externalOrderId: 'DD-1001', netSales: 40, commissions: 8, promotions: 2, otherFees: 1.2, taxes: 2.8, payout: 31.6, saleDate: '2026-10-05', payoutDate: '2026-10-08' });
  });

  it('reembolso vira registro próprio com vendas negativas e taxas estornadas', () => {
    const refund = dd().records.find(r => r.kind === 'refund')!;
    expect(refund.externalOrderId).toBe('DD-1002');
    expect(refund.netSales).toBe(-25);
    expect(refund.commissions).toBe(-5);
    expect(refund.recordKey).not.toBe(dd().records[1].recordKey);
  });

  it('venda no fim do mês com repasse no mês seguinte', () => {
    const recs = dd().records;
    const oct = summarizeMonth(recs, '2026-10');
    const nov = summarizeMonth(recs, '2026-11');
    const c = oct.channels.find(x => x.channel === 'doordash')!;
    expect(c.netSales).toBe(1100);            // 40 + 25 − 25 + 1060
    expect(c.salesPaidLater).toBe(1060);      // vendida em 31/10, paga em 03/11
    expect(c.payoutsInMonth).toBe(31.6);      // só repasses com data em outubro (+20.99 − 20.99)
    expect(nov.channels.find(x => x.channel === 'doordash')!.payoutsInMonth).toBe(890.4);
    expect(nov.channels.find(x => x.channel === 'doordash')!.netSales).toBe(0);
    expect(c.effectiveFeeRate).toBeCloseTo((8 + 2 + 1.2 + 212 + 31.8) / 1100, 6);
    expect(c.payoutDivergences).toBe(0);
  });

  it('importar o mesmo arquivo duas vezes não duplica (mesmas chaves, tudo reconhecido)', () => {
    const first = dd().records;
    const existing = new Map(first.map(r => [r.recordKey, r] as const));
    const second = dd().records;
    expect(second.map(r => r.recordKey)).toEqual(first.map(r => r.recordKey));
    expect(diffExisting(second, existing)).toEqual({ inserted: 0, updated: 0, unchanged: 4 });
    // período sobreposto com um valor corrigido → atualiza, não soma de novo
    const changed = second.map(r => (r.externalOrderId === 'DD-1001' ? { ...r, payout: 31.5 } : r));
    expect(diffExisting(changed, existing)).toEqual({ inserted: 0, updated: 1, unchanged: 3 });
  });
});

describe('mapeamento: colunas ausentes ou ambíguas', () => {
  it('coluna essencial ausente bloqueia a importação', () => {
    const a = analyze(parseCsv('Order ID,Commission\nA1,2.00'), { source: 'generic:x', channel: 'direct' });
    expect(a.issues.map(i => i.code)).toEqual(expect.arrayContaining(['missingSaleDate', 'missingSales']));
    expect(a.issues.some(i => i.blocking)).toBe(true);
  });
  it('duas colunas possíveis para vendas → ambíguo; corrigir o mapeamento resolve', () => {
    const t = parseCsv('Date,Order ID,Net Sales,Net Sales (USD)\n2026-10-01,A1,10.00,10.00');
    const a = analyze(t, { source: 'generic:x', channel: 'direct' });
    expect(a.issues.find(i => i.code === 'ambiguous' && i.field === 'netSales')?.blocking).toBe(true);
    const fixed = analyze(t, { source: 'generic:x', channel: 'direct', mapping: { netSales: 2 } });
    expect(fixed.issues.some(i => i.blocking)).toBe(false);
    expect(fixed.records[0].netSales).toBe(10);
  });
  it('datas e números em formatos diferentes', () => {
    expect(parseMoney('(12.50)', '.')).toBe(-12.5);
    expect(parseMoney('R$ 1.234,56', ',')).toBe(1234.56);
    expect(parseDate('31/10/2026', 'dmy')).toBe('2026-10-31');
    expect(detectDateOrder(['03/04/2026']).ambiguous).toBe(true);
    expect(detectDateOrder(['10/31/2026']).order).toBe('mdy');
  });
});

describe('Square + conciliação', () => {
  const unit = () => 'Brickell';
  const sq = (id: string, ref: string | undefined, cents: number, date: string, source = 'DoorDash') => normalizeSquareOrder({
    id, reference_id: ref, closed_at: `${date}T19:00:00Z`, source: { name: source },
    net_amounts: { total_money: { amount: cents + Math.round(cents * 0.07), currency: 'USD' }, tax_money: { amount: Math.round(cents * 0.07), currency: 'USD' }, tip_money: { amount: 0, currency: 'USD' } },
  }, 0, unit);

  it('normaliza pedido, taxa de processamento e repasse do Square', () => {
    const fees = feesByOrder([{ id: 'p1', order_id: 'SQ-9', processing_fee: [{ amount_money: { amount: 59, currency: 'USD' } }] }]);
    const r = normalizeSquareOrder({ id: 'SQ-9', closed_at: '2026-10-02T15:00:00Z', source: { name: 'Square Point of Sale' }, net_amounts: { total_money: { amount: 2140, currency: 'USD' }, tax_money: { amount: 140, currency: 'USD' }, tip_money: { amount: 0, currency: 'USD' } } }, fees.get('SQ-9')!, unit);
    expect(r).toMatchObject({ netSales: 20, taxes: 1.4, otherFees: 0.59, channel: 'counter', saleDate: '2026-10-02', unit: 'Brickell' });
    expect(normalizeSquarePayout({ id: 'po1', arrival_date: '2026-10-04', amount_money: { amount: 1981, currency: 'USD' } }, unit)).toMatchObject({ kind: 'payout', payout: 19.81, payoutDate: '2026-10-04' });
  });

  it('pedido no Square e no DoorDash: concilia pelo nº do pedido e conta uma vez só', () => {
    const delivery = dd().records;
    const square: SalesRecord[] = [sq('SQ-1', 'DD-1001', 4000, '2026-10-05'), sq('SQ-2', 'DD-1003', 99000, '2026-10-31'), sq('SQ-3', undefined, 1500, '2026-10-20', 'Square Point of Sale')];
    const res = reconcile(square, delivery);
    expect(res.matched).toBe(1);   // DD-1001 bate (valor e data)
    expect(res.review).toBe(1);    // DD-1003: nº igual, valor diferente → revisão
    const all = [...square, ...delivery].map(r => res.updates.find(u => u.source === r.source && u.recordKey === r.recordKey) ?? r);
    expect(all.find(r => r.recordKey === 'order:SQ-1')!.matchStatus).toBe('matched');
    expect(countsInTotals(all.find(r => r.recordKey === 'order:SQ-1')!)).toBe(false);
    expect(all.find(r => r.recordKey === 'order:SQ-2')!.matchStatus).toBe('review');
    const oct = summarizeMonth(all, '2026-10');
    expect(oct.channels.find(c => c.channel === 'doordash')!.netSales).toBe(1100); // DoorDash conta pelo extrato dele
    // SQ-2 em revisão fica fora dos totais até a decisão; SQ-3 é balcão
    expect(oct.channels.find(c => c.channel === 'counter')!.netSales).toBe(15);
    expect(oct.review).toBe(1);
    expect(oct.reviewAmount).toBe(990);
    // decisão manual preservada ao conciliar de novo
    const distinct = all.map(r => (r.recordKey === 'order:SQ-2' ? { ...r, matchStatus: 'distinct' as const } : r));
    const again = reconcile(distinct.filter(r => r.source === 'square'), delivery);
    expect(again.updates.find(u => u.recordKey === 'order:SQ-2')).toBeUndefined();
  });

  it('sem nº correspondente, valor e data iguais só geram sugestão para revisão', () => {
    const delivery = dd().records;
    const res = reconcile([sq('SQ-7', undefined, 4000, '2026-10-05')], delivery);
    expect(res.matched).toBe(0);
    expect(res.review).toBe(1);
  });
});
