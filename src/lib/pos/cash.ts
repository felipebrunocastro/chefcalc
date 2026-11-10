import type { CartLine, CashMovement, CashSession, PosSale, SaleEvent } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface CartTotals { subtotal: number; discount: number; tax: number; total: number; change: number | null; short: boolean }

// Desconto (valor) limitado ao subtotal; imposto sobre o valor com desconto, por item (taxa do item).
export function cartTotals(lines: CartLine[], discount: number, received: number | null): CartTotals {
  const subtotal = r2(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
  const disc = r2(Math.min(Math.max(discount || 0, 0), subtotal));
  const factor = subtotal > 0 ? (subtotal - disc) / subtotal : 0;
  const tax = r2(lines.reduce((a, l) => a + l.qty * l.unitPrice * factor * ((l.taxPct || 0) / 100), 0));
  const total = r2(subtotal - disc + tax);
  const change = received == null ? null : r2(received - total);
  return { subtotal, discount: disc, tax, total, change, short: change !== null && change < -0.001 };
}

// Mesma regra do servidor (função expected_cash): saldo inicial + vendas em dinheiro + suprimentos − sangrias − reembolsos em dinheiro.
export function expectedCash(session: Pick<CashSession, 'id' | 'openingCash'>, sales: PosSale[], movements: CashMovement[], events: SaleEvent[]): number {
  const sid = session.id;
  const cashSales = sales.filter(s => s.sessionId === sid && s.status === 'completed' && s.payment === 'cash').reduce((a, s) => a + s.total, 0);
  const supply = movements.filter(m => m.sessionId === sid && m.kind === 'supply').reduce((a, m) => a + m.amount, 0);
  const out = movements.filter(m => m.sessionId === sid && (m.kind === 'withdrawal' || m.kind === 'refund')).reduce((a, m) => a + m.amount, 0);
  const refunds = events.filter(e => e.sessionId === sid && e.kind === 'refund' && e.cash).reduce((a, e) => a + e.amount, 0);
  return r2(session.openingCash + cashSales + supply - out - refunds);
}

export type CashResult = 'over' | 'short' | 'ok';
export const cashResult = (difference: number): CashResult => (difference > 0.004 ? 'over' : difference < -0.004 ? 'short' : 'ok');

// Data operacional no fuso do restaurante.
export function opDate(now: Date, timeZone?: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
}

export const saleCode = () => `CX-${Date.now().toString(36).toUpperCase().slice(-6)}`;
