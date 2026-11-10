// Registro de venda normalizado (compartilhado entre o app e as Edge Functions).
export type RecordKind = 'order' | 'refund' | 'adjustment' | 'payout';
export type MatchStatus = 'none' | 'matched' | 'review' | 'distinct';

export interface SalesRecord {
  source: string;                 // 'square' | 'doordash' | 'ubereats' | 'grubhub' | 'generic:<nome>'
  recordKey: string;              // único por restaurante + fonte
  channel: string;                // canal do ChefCalc
  unit: string;                   // unidade / loja
  kind: RecordKind;
  externalOrderId: string | null;
  externalRef: string | null;
  sourceName: string | null;
  saleDate: string | null;        // data da venda (YYYY-MM-DD)
  payoutDate: string | null;      // data do repasse (YYYY-MM-DD)
  netSales: number;               // após descontos e devoluções
  commissions: number;
  promotions: number;             // custeadas pelo restaurante
  otherFees: number;
  taxes: number;
  tips: number;
  adjustments: number;
  payout: number | null;
  currency: string | null;
  matchStatus: MatchStatus;
  matchedSource: string | null;
  matchedKey: string | null;
  batchId?: string | null;
  importedAt?: string;
  raw?: Record<string, unknown> | null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function emptyRecord(partial: Partial<SalesRecord> & Pick<SalesRecord, 'source' | 'recordKey' | 'channel'>): SalesRecord {
  return {
    unit: '', kind: 'order', externalOrderId: null, externalRef: null, sourceName: null,
    saleDate: null, payoutDate: null, netSales: 0, commissions: 0, promotions: 0, otherFees: 0,
    taxes: 0, tips: 0, adjustments: 0, payout: null, currency: null,
    matchStatus: 'none', matchedSource: null, matchedKey: null, ...partial,
  };
}
