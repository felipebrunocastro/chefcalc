import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cartTotals, expectedCash, cashResult, opDate } from '../lib/pos/cash';
import { buildLines, dayResult, rangeResult, monthLayer, weekRange, salesAsRecords, type ConsolidateInput } from '../lib/pos/consolidate';
import { reconcile } from '../lib/imports/reconcile';
import { analyze, parseCsv, diffExisting, type SalesRecord } from '../lib/imports/normalize';
import type { CashMovement, CashSession, ChannelSummary, PosSale, SaleEvent, CartLine } from '../lib/pos/types';

const session = (o: Partial<CashSession> = {}): CashSession => ({
  id: 's1', unit: 'Centro', opDate: '2026-11-10', shift: 'Noite', responsible: 'Ana', openingCash: 50, status: 'open',
  openedAt: '2026-11-10T22:00:00Z', openedBy: 'u', closedAt: null, closedBy: null, countedCash: null, expectedCash: null, difference: null, corrections: [], ...o,
});
const sale = (id: string, total: number, o: Partial<PosSale> = {}): PosSale => ({
  id, sessionId: 's1', unit: 'Centro', opDate: '2026-11-10', code: `CX-${id}`, clientToken: id, channel: 'counter', payment: 'cash',
  items: [{ productId: 'p1', name: 'Burger', addons: [], qty: 1, unitPrice: total, lineTotal: total, taxPct: 0 }],
  subtotal: total, discount: 0, tax: 0, total, received: total, change: 0, status: 'completed', createdAt: '', createdBy: null, ...o,
});
const mv = (kind: CashMovement['kind'], amount: number): CashMovement => ({ id: kind + amount, sessionId: 's1', kind, amount, reason: 'x', responsible: 'Ana', createdAt: '' });
const summary = (o: Partial<ChannelSummary>): ChannelSummary => ({
  id: 'sum1', unit: 'Centro', opDate: '2026-11-10', channel: 'ubereats', sourceName: null, includes: {}, grossSales: 0, orders: null,
  discounts: 0, refunds: 0, fees: 0, payout: null, payoutDate: null, status: 'active', overlapResolution: null, createdAt: '', createdByEmail: null, ...o,
});
const input = (o: Partial<ConsolidateInput>): ConsolidateInput => ({ sales: [], events: [], sessions: [], summaries: [], records: [], expectedChannels: [], ...o });

describe('caixa', () => {
  it('1. fechamento físico: 50 + 180 − 30 − 10 = 190; contado 188 → falta 2', () => {
    const sales = [sale('a', 100), sale('b', 80)];
    const exp = expectedCash(session(), sales, [mv('withdrawal', 30), mv('refund', 10)], []);
    expect(exp).toBe(190);
    expect(188 - exp).toBe(-2);
    expect(cashResult(188 - exp)).toBe('short');
    expect(cashResult(0)).toBe('ok');
    expect(cashResult(1)).toBe('over');
  });

  it('venda cancelada não entra; reembolso em dinheiro sai do caixa e das vendas', () => {
    const sales = [sale('a', 100), sale('b', 80, { status: 'cancelled' })];
    const ev: SaleEvent[] = [{ id: 'e', saleId: 'a', sessionId: 's1', kind: 'refund', amount: 20, cash: true, reason: 'x', responsible: '', createdAt: '' }];
    expect(expectedCash(session(), sales, [], ev)).toBe(130);
    const inp = input({ sales, events: ev, sessions: [session()] });
    expect(dayResult('2026-11-10', inp, buildLines(inp)).net).toBe(80);
  });

  it('carrinho: desconto, imposto, recebido e troco', () => {
    const lines: CartLine[] = [{ key: '1', productId: 'p', name: 'Burger', addons: [], qty: 2, unitPrice: 12, taxPct: 7 }, { key: '2', productId: 'q', name: 'Soda', addons: [], qty: 1, unitPrice: 3, taxPct: 0 }];
    const t = cartTotals(lines, 2.7, 30);
    expect(t).toMatchObject({ subtotal: 27, discount: 2.7, tax: 1.51, total: 25.81, change: 4.19, short: false });
    expect(cartTotals(lines, 0, 10).short).toBe(true);
  });

  it('data operacional no fuso do restaurante (turno após a meia-noite fica na data de abertura)', () => {
    expect(opDate(new Date('2026-11-11T03:30:00Z'), 'America/New_York')).toBe('2026-11-10');
    expect(opDate(new Date('2026-11-11T03:30:00Z'), 'Europe/Madrid')).toBe('2026-11-11');
  });
});

const ddCsv = readFileSync(new URL('./fixtures/doordash-oct.csv', import.meta.url), 'utf8');

describe('consolidação', () => {
  it('2. pedido do DoorDash também no Square conta uma vez só', () => {
    const delivery = analyze(parseCsv(ddCsv), { source: 'doordash', channel: 'doordash' }).records.filter(r => r.externalOrderId === 'DD-1001');
    const square: SalesRecord = { ...delivery[0], source: 'square', recordKey: 'order:SQ-1', channel: 'doordash', externalOrderId: 'SQ-1', externalRef: 'DD-1001', commissions: 0, promotions: 0, otherFees: 0, payout: null };
    const res = reconcile([square], delivery);
    const records = [square, ...delivery].map(r => res.updates.find(u => u.source === r.source && u.recordKey === r.recordKey) ?? r);
    const inp = input({ records });
    const day = dayResult('2026-10-05', inp, buildLines(inp));
    expect(day.net).toBe(40);
    expect(day.byChannel.doordash.orders).toBe(1);
  });

  it('venda em dinheiro do caixa também lançada no Square: concilia pelo código CX-', () => {
    const sales = [sale('a', 25, { code: 'CX-K9F2QA' })];
    const square: SalesRecord = { ...salesAsRecords(sales)[0], source: 'square', recordKey: 'order:SQ-9', externalOrderId: 'SQ-9', externalRef: 'CX-K9F2QA', paymentMethod: 'cash' };
    const res = reconcile([square], salesAsRecords(sales));
    expect(res.matched).toBe(1);
    const sameAmountNoRef = reconcile([{ ...square, externalRef: null, matchStatus: 'none' }], salesAsRecords(sales));
    expect(sameAmountNoRef.review).toBe(1); // mesmo valor e dia, sem nº → revisão
  });

  it('3. relatório atrasado: Uber Eats importado no dia seguinte entra na data operacional e o contado fica preservado', () => {
    const closed = session({ status: 'closed', countedCash: 188, expectedCash: 190, difference: -2 });
    const base = input({ sales: [sale('a', 180)], sessions: [closed], expectedChannels: ['ubereats'] });
    const before = dayResult('2026-11-10', base, buildLines(base));
    expect(before.physicalClosed).toBe(true);
    expect(before.consolidated).toBe(false);
    expect(before.pendingChannels).toEqual(['ubereats']);
    expect(before.status).toBe('pending');
    const after = input({ ...base, summaries: [summary({ grossSales: 120, discounts: 10, refunds: 5, orders: 6, fees: 30, createdAt: '2026-11-11T10:00:00Z' })] });
    const day = dayResult('2026-11-10', after, buildLines(after));
    expect(day.net).toBe(285);            // 180 + (120 − 10 − 5)
    expect(day.consolidated).toBe(true);
    expect(day.sessions[0].countedCash).toBe(188);
    expect(day.fees).toBe(30);            // taxas separadas da receita
    expect(dayResult('2026-11-11', after, buildLines(after)).net).toBe(0);
  });

  it('4. histórico: reimportar CSV não muda totais; preço alterado não muda vendas antigas; dia/semana/mês/ano', () => {
    const first = analyze(parseCsv(ddCsv), { source: 'doordash', channel: 'doordash' }).records;
    const again = analyze(parseCsv(ddCsv), { source: 'doordash', channel: 'doordash' }).records;
    expect(diffExisting(again, new Map(first.map(r => [r.recordKey, r] as const)))).toEqual({ inserted: 0, updated: 0, unchanged: 4 });
    const oldSale = sale('old', 12, { opDate: '2026-10-30', items: [{ productId: 'p1', name: 'Burger', addons: [], qty: 1, unitPrice: 12, lineTotal: 12, taxPct: 0 }] });
    const newSale = sale('new', 14, { opDate: '2026-11-02', items: [{ productId: 'p1', name: 'Burger', addons: [], qty: 1, unitPrice: 14, lineTotal: 14, taxPct: 0 }] }); // preço mudou para 14
    const inp = input({ sales: [oldSale, newSale], records: first });
    const built = buildLines(inp);
    expect(dayResult('2026-10-30', inp, built).products[0]).toMatchObject({ name: 'Burger', qty: 1, total: 12 });
    const week = weekRange('2026-10-30');                 // semana atravessa outubro e novembro
    expect(week).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(rangeResult(week.from, week.to, inp, built).net).toBe(12 + 1060);  // venda + DoorDash de 31/10
    expect(rangeResult('2026-10-01', '2026-10-31', inp, built).net).toBe(12 + 1100);
    expect(rangeResult('2026-11-01', '2026-11-30', inp, built).net).toBe(14);
    expect(rangeResult('2026-01-01', '2026-12-31', inp, built).net).toBe(12 + 1100 + 14);
    const layer = monthLayer('2026-11', inp, built);
    expect(layer.channels.counter).toBe(14);
    expect(layer.payouts.doordash).toBe(890.4);           // repasse pela data do repasse
  });

  it('resumo manual substituído por relatório detalhado só após revisão', () => {
    const det = analyze(parseCsv(ddCsv), { source: 'doordash', channel: 'doordash' }).records.map(r => ({ ...r, unit: 'Centro' }));
    const sum = summary({ channel: 'doordash', opDate: '2026-10-05', grossSales: 45 });
    const inp = input({ records: det, summaries: [sum] });
    const d = dayResult('2026-10-05', inp, buildLines(inp));
    expect(d.provisional).toBe(true);
    expect(d.net).toBe(45);                                // conta o resumo até a revisão
    expect(d.conflicts[0]).toMatchObject({ kind: 'detailedVsSummary', detailedAmount: 40 });
    const replaced = input({ records: det, summaries: [{ ...sum, status: 'replaced' }] });
    expect(dayResult('2026-10-05', replaced, buildLines(replaced))).toMatchObject({ net: 40, provisional: false });
  });

  it('total agregado do Square com sobreposição: provisório até declarar', () => {
    const sq = summary({ id: 'sq', channel: 'square', grossSales: 300, includes: { payments: ['cash', 'card'] } });
    const inp = input({ sales: [sale('a', 100)], summaries: [sq], sessions: [session({ status: 'closed', countedCash: 150 })] });
    const d = dayResult('2026-11-10', inp, buildLines(inp));
    expect(d.provisional).toBe(true);
    expect(d.pendingAmount).toBe(100);
    const ded = input({ ...inp, summaries: [{ ...sq, overlapResolution: 'deduct' }] });
    expect(dayResult('2026-11-10', ded, buildLines(ded))).toMatchObject({ net: 300, provisional: false });
    const sep = input({ ...inp, summaries: [{ ...sq, overlapResolution: 'separate' }] });
    expect(dayResult('2026-11-10', sep, buildLines(sep)).net).toBe(400);
  });

  it('status do dia, ticket médio e "sem detalhamento por produto"', () => {
    const empty = input({});
    expect(dayResult('2026-11-10', empty, buildLines(empty)).status).toBe('none');
    const zero = input({ summaries: [summary({ channel: '__day__' })] });
    expect(dayResult('2026-11-10', zero, buildLines(zero)).status).toBe('zero');
    const open = input({ sessions: [session()] });
    expect(dayResult('2026-11-10', open, buildLines(open)).status).toBe('open');
    const mixed = input({ sales: [sale('a', 50)], summaries: [summary({ grossSales: 100, orders: null })], sessions: [session({ status: 'closed' })] });
    const d = dayResult('2026-11-10', mixed, buildLines(mixed));
    expect(d.status).toBe('consolidated');
    expect(d.ticket).toBeNull();                          // Uber Eats sem nº de pedidos → sem ticket
    expect(d.byChannel.ubereats.productDetail).toBe(false);
    expect(d.productChannels).toEqual(['counter']);
    const withOrders = input({ ...mixed, summaries: [summary({ grossSales: 100, orders: 4 })] });
    expect(dayResult('2026-11-10', withOrders, buildLines(withOrders)).ticket).toBe(30); // 150 / 5
  });

  it('filtros por unidade, canal e forma de pagamento', () => {
    const inp = input({ sales: [sale('a', 50), sale('b', 20, { unit: 'Praia' })], summaries: [summary({ grossSales: 100 })] });
    const b = buildLines(inp);
    expect(dayResult('2026-11-10', inp, b, { unit: 'Praia' }).net).toBe(20);
    expect(dayResult('2026-11-10', inp, b, { channel: 'ubereats' }).net).toBe(100);
    expect(dayResult('2026-11-10', inp, b, { payment: 'cash' }).net).toBe(70);
  });
});
