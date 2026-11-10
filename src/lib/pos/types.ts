// Caixa e Vendas — tipos compartilhados.
export type Payment = 'cash' | 'card' | 'online' | 'other';
export type SourceKind = 'chefcalc' | 'square' | 'csv' | 'manual';

export interface PosOption { id: string; name: string; price: number }
export interface PosProduct {
  id: string; name: string; category: string; price: number; dishId?: string | null;
  sizes: PosOption[]; addons: PosOption[]; taxPct: number | null; active: boolean; sort: number;
}

export interface CartLine {
  key: string; productId: string; name: string; size?: string | null; addons: string[];
  qty: number; unitPrice: number;           // preço praticado no momento (inclui tamanho e adicionais)
  taxPct: number;
}

export interface SaleItem { productId: string; name: string; size?: string | null; addons: string[]; qty: number; unitPrice: number; lineTotal: number; taxPct: number }

export interface CashSession {
  id: string; unit: string; opDate: string; shift: string; responsible: string; openingCash: number;
  status: 'open' | 'closed'; openedAt: string; openedBy: string | null; closedAt: string | null; closedBy: string | null;
  countedCash: number | null; expectedCash: number | null; difference: number | null;
  corrections: { at: string; byEmail?: string; reason: string; from: number; to: number }[];
}

export interface PosSale {
  id: string; sessionId: string; unit: string; opDate: string; code: string; clientToken: string;
  channel: string; payment: Payment; items: SaleItem[];
  subtotal: number; discount: number; tax: number; total: number; received: number | null; change: number | null;
  status: 'completed' | 'cancelled'; createdAt: string; createdBy: string | null;
}

export interface SaleEvent { id: string; saleId: string; sessionId: string | null; kind: 'cancel' | 'refund'; amount: number; cash: boolean; reason: string; responsible: string; createdAt: string }
export interface CashMovement { id: string; sessionId: string; kind: 'supply' | 'withdrawal' | 'refund'; amount: number; reason: string; responsible: string; createdAt: string }

export interface ChannelSummary {
  id: string; unit: string; opDate: string; channel: string; sourceName: string | null;
  includes: { channels?: string[]; payments?: Payment[] };
  grossSales: number; orders: number | null; discounts: number; refunds: number; fees: number;
  payout: number | null; payoutDate: string | null;
  status: 'active' | 'replaced' | 'kept'; overlapResolution: 'deduct' | 'separate' | null;
  createdAt: string; createdByEmail: string | null;
}
