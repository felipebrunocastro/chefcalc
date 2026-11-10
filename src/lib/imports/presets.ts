// Fontes de importação e nomes de coluna conhecidos.
// Os aliases cobrem nomes usuais dos relatórios; a prévia sempre permite corrigir o mapeamento.

export type CanonicalField =
  | 'orderId' | 'saleDate' | 'payoutDate' | 'unit' | 'kind'
  | 'grossSales' | 'discounts' | 'refunds' | 'netSales'
  | 'commissions' | 'promotions' | 'otherFees' | 'taxes' | 'tips' | 'adjustments' | 'payout';

export const FIELDS: CanonicalField[] = [
  'orderId', 'saleDate', 'payoutDate', 'unit', 'kind',
  'grossSales', 'discounts', 'refunds', 'netSales',
  'commissions', 'promotions', 'otherFees', 'taxes', 'tips', 'adjustments', 'payout',
];
export const MONEY_FIELDS: CanonicalField[] = ['grossSales', 'discounts', 'refunds', 'netSales', 'commissions', 'promotions', 'otherFees', 'taxes', 'tips', 'adjustments', 'payout'];
// Custos que algumas plataformas exportam como valores negativos.
export const COST_FIELDS: CanonicalField[] = ['discounts', 'refunds', 'commissions', 'promotions', 'otherFees'];

export interface SourcePreset {
  id: string;                         // 'doordash' | 'ubereats' | 'grubhub' | 'generic'
  name: string;
  channel: string;
  dateOrder: 'mdy' | 'dmy';           // padrão quando a data é ambígua (ex.: 03/04/2026)
  aliases: Partial<Record<CanonicalField, string[]>>;
}

const common: Partial<Record<CanonicalField, string[]>> = {
  orderId: ['order id', 'order number', 'order #', 'pedido', 'id do pedido', 'número do pedido', 'transaction id'],
  saleDate: ['order date', 'date', 'transaction date', 'sale date', 'data', 'data da venda', 'fecha'],
  payoutDate: ['payout date', 'deposit date', 'data do repasse', 'fecha de pago'],
  unit: ['store name', 'store', 'location', 'restaurant', 'unidade', 'loja'],
  kind: ['transaction type', 'type', 'tipo'],
  grossSales: ['subtotal', 'gross sales', 'sales', 'vendas brutas'],
  discounts: ['discounts', 'discount', 'descontos'],
  refunds: ['refunds', 'refund', 'reembolsos', 'devoluções'],
  netSales: ['net sales', 'vendas líquidas', 'ventas netas'],
  commissions: ['commission', 'commissions', 'comissão'],
  promotions: ['promotions', 'marketing', 'promoções'],
  otherFees: ['fees', 'other fees', 'processing fee', 'taxas'],
  taxes: ['tax', 'sales tax', 'impostos'],
  tips: ['tip', 'tips', 'gorjeta', 'gorjetas'],
  adjustments: ['adjustments', 'adjustment', 'ajustes'],
  payout: ['payout', 'net payout', 'repasse', 'net total'],
};

export const PRESETS: Record<string, SourcePreset> = {
  doordash: {
    id: 'doordash', name: 'DoorDash', channel: 'doordash', dateOrder: 'mdy',
    aliases: {
      ...common,
      orderId: ['doordash order id', 'order id', 'delivery uuid', ...common.orderId!],
      saleDate: ['timestamp local date', 'timestamp utc date', 'order received date', ...common.saleDate!],
      payoutDate: ['payout date', 'payout_date', ...common.payoutDate!],
      unit: ['store name', 'store id', 'merchant store id', ...common.unit!],
      discounts: ['customer discounts funded by you', 'merchant funded discount', ...common.discounts!],
      refunds: ['error charges', 'error charge', ...common.refunds!],
      promotions: ['marketing fees', 'marketing fee', 'marketing fees | (including any applicable taxes)', ...common.promotions!],
      otherFees: ['payment processing fee', 'tablet fee', ...common.otherFees!],
      taxes: ['tax (subtotal)', 'subtotal tax passed to merchant', ...common.taxes!],
      tips: ['dasher tip', 'tip', ...common.tips!],
      payout: ['net total', 'net payout', ...common.payout!],
    },
  },
  ubereats: {
    id: 'ubereats', name: 'Uber Eats', channel: 'ubereats', dateOrder: 'mdy',
    aliases: {
      ...common,
      orderId: ['order id', 'workflow id', ...common.orderId!],
      saleDate: ['order date', 'date ordered', 'order accept time', ...common.saleDate!],
      grossSales: ['sales (excl. tax)', 'food sales', ...common.grossSales!],
      refunds: ['refunds (excl. tax)', ...common.refunds!],
      promotions: ['promotions on items', 'offers on items (incl. tax)', 'marketing adjustment', ...common.promotions!],
      commissions: ['marketplace fee', 'uber service fee', ...common.commissions!],
      otherFees: ['other payments', 'delivery network fee', ...common.otherFees!],
      taxes: ['tax on sales', ...common.taxes!],
      tips: ['gratuity', ...common.tips!],
      payout: ['total payout', ...common.payout!],
      kind: ['order status', ...common.kind!],
    },
  },
  grubhub: {
    id: 'grubhub', name: 'Grubhub', channel: 'grubhub', dateOrder: 'mdy',
    aliases: {
      ...common,
      orderId: ['order number', ...common.orderId!],
      saleDate: ['transaction date', ...common.saleDate!],
      payoutDate: ['deposit date', ...common.payoutDate!],
      grossSales: ['food total', ...common.grossSales!],
      discounts: ['restaurant promo', 'self-funded promotion', ...common.discounts!],
      commissions: ['marketing commission', 'delivery commission', ...common.commissions!],
      payout: ['restaurant total', ...common.payout!],
    },
  },
  generic: { id: 'generic', name: '', channel: '', dateOrder: 'mdy', aliases: common },
};
