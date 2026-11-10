import Papa from 'papaparse';
import { emptyRecord, round2, type RecordKind, type SalesRecord } from '../../../supabase/functions/_shared/salesRecord.ts';
import { COST_FIELDS, FIELDS, MONEY_FIELDS, PRESETS, type CanonicalField, type SourcePreset } from './presets';

export type { SalesRecord } from '../../../supabase/functions/_shared/salesRecord.ts';

export type Mapping = Partial<Record<CanonicalField, number | null>>; // índice da coluna (null = sem coluna)
export type DateOrder = 'ymd' | 'mdy' | 'dmy';

export type IssueCode =
  | 'missingSaleDate' | 'missingSales' | 'missingOrderId' | 'missingPayoutDate' | 'missingPayout'
  | 'ambiguous' | 'dateAmbiguous' | 'badDates' | 'badNumbers' | 'signFlipped' | 'empty';
export interface Issue { code: IssueCode; field?: CanonicalField; columns?: string[]; count?: number; blocking: boolean }

export interface ImportOptions {
  source: string;               // 'doordash' | ... | 'generic:<slug>'
  channel: string;
  unit?: string;                // unidade escolhida (quando o arquivo não informa)
  mapping?: Mapping;            // mapeamento corrigido pelo usuário
  dateOrder?: DateOrder;
  decimal?: '.' | ',';
}

export interface Analysis {
  headers: string[];
  rows: string[][];
  mapping: Mapping;
  candidates: Partial<Record<CanonicalField, number[]>>;
  issues: Issue[];
  dateOrder: DateOrder;
  decimal: '.' | ',';
  flipped: CanonicalField[];
  records: SalesRecord[];
  period: { start: string | null; end: string | null };
  units: string[];
  totals: Totals;
  counts: Record<RecordKind, number>;
}

export interface Totals {
  netSales: number; commissions: number; promotions: number; otherFees: number;
  taxes: number; tips: number; adjustments: number; payout: number;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[“”"]/g, '').trim();

export function parseCsv(text: string): string[][] {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
  return (res.data as string[][]).map(r => r.map(c => (c ?? '').trim()));
}

// Colunas que nunca devem ser tomadas por um campo em correspondência parcial.
const EXCLUDE: Partial<Record<CanonicalField, RegExp>> = {
  grossSales: /net|tax|refund|devolu|imposto/,
  netSales: /tax|imposto|payout|repasse/,
  payout: /date|data|fecha/,
  saleDate: /payout|deposit|repasse|pago/,
  orderId: /store|loja|location/,
};

// Detecta colunas por nome, em duas passagens:
// 1) correspondência exata (reserva a coluna); 2) correspondência parcial nas colunas livres.
// Mais de uma coluna plausível para o mesmo campo → ambíguo (o usuário escolhe na prévia).
export function detectMapping(headers: string[], preset: SourcePreset): { mapping: Mapping; candidates: Partial<Record<CanonicalField, number[]>> } {
  const h = headers.map(norm);
  const mapping: Mapping = {};
  const candidates: Partial<Record<CanonicalField, number[]>> = {};
  const exact: Partial<Record<CanonicalField, number[]>> = {};
  const reserved = new Set<number>();
  for (const f of FIELDS) {
    for (const a of (preset.aliases[f] ?? []).map(norm)) {
      const hits = h.map((x, i) => (x === a && !reserved.has(i) ? i : -1)).filter(i => i >= 0);
      if (hits.length) { exact[f] = hits; if (hits.length === 1) reserved.add(hits[0]); break; }
    }
  }
  for (const f of FIELDS) {
    const aliases = (preset.aliases[f] ?? []).map(norm).filter(a => a.length >= 4);
    const ex = exact[f] ?? [];
    const partial = [...new Set(aliases.flatMap(a => h.map((x, i) =>
      (x.includes(a) && !reserved.has(i) && !ex.includes(i) && !(EXCLUDE[f]?.test(x)) ? i : -1)).filter(i => i >= 0)))];
    const all = [...ex, ...partial];
    candidates[f] = all;
    if (all.length === 1) { mapping[f] = all[0]; reserved.add(all[0]); }
    else mapping[f] = null;
  }
  return { mapping, candidates };
}

export function parseMoney(v: string | undefined, decimal: '.' | ','): number | null {
  if (v == null) return null;
  let s = v.trim();
  if (!s || s === '-' || s === '—') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[^\d.,-]/g, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (decimal === ',') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!s || isNaN(Number(s))) return NaN;
  const n = Number(s);
  return neg ? -n : n;
}

export function detectDecimal(values: string[]): '.' | ',' {
  let comma = 0, dot = 0;
  for (const v of values) {
    if (/\d,\d{1,2}$/.test(v.trim()) && !/\.\d{1,2}$/.test(v.trim())) comma++;
    if (/\d\.\d{1,2}$/.test(v.trim())) dot++;
  }
  return comma > dot ? ',' : '.';
}

export function detectDateOrder(values: string[]): { order: DateOrder | null; ambiguous: boolean } {
  let ymd = 0, firstBig = 0, secondBig = 0, slash = 0;
  for (const v of values) {
    const s = v.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) { ymd++; continue; }
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (!m) continue;
    slash++;
    if (+m[1] > 12) firstBig++;
    if (+m[2] > 12) secondBig++;
  }
  if (ymd && !slash) return { order: 'ymd', ambiguous: false };
  if (firstBig && !secondBig) return { order: 'dmy', ambiguous: false };
  if (secondBig && !firstBig) return { order: 'mdy', ambiguous: false };
  return { order: null, ambiguous: slash > 0 };
}

export function parseDate(v: string | undefined, order: DateOrder): string | null | undefined {
  if (!v || !v.trim()) return null;
  const s = v.trim();
  let y: number, mo: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const sl = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (iso) { y = +iso[1]; mo = +iso[2]; d = +iso[3]; }
  else if (sl) {
    const a = +sl[1], b = +sl[2];
    y = +sl[3]; if (y < 100) y += 2000;
    if (order === 'dmy') { d = a; mo = b; } else { mo = a; d = b; }
  } else return undefined;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function kindOf(v: string | undefined, net: number): RecordKind {
  const s = (v ?? '').toLowerCase();
  if (/refund|reembolso|devolu|error charge|cancel/.test(s)) return 'refund';
  if (/adjust|ajuste/.test(s)) return 'adjustment';
  if (/payout|repasse|deposit/.test(s) && !/order/.test(s)) return 'payout';
  if (!s && net < 0) return 'refund';
  return 'order';
}

// Hash FNV-1a de 32 bits (estável) para linhas sem nº de pedido.
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function presetFor(source: string): SourcePreset {
  return PRESETS[source] ?? PRESETS.generic;
}

export function analyze(table: string[][], opts: ImportOptions): Analysis {
  const preset = presetFor(opts.source);
  const [headers = [], ...rows] = table;
  const det = detectMapping(headers, preset);
  const mapping: Mapping = { ...det.mapping, ...(opts.mapping ?? {}) };
  const issues: Issue[] = [];
  const col = (f: CanonicalField) => mapping[f];
  const cell = (r: string[], f: CanonicalField) => { const i = col(f); return i == null || i < 0 ? undefined : r[i]; };

  if (rows.length === 0) issues.push({ code: 'empty', blocking: true });

  // Ambiguidades ainda não resolvidas pelo usuário
  for (const f of FIELDS) {
    const c = det.candidates[f] ?? [];
    if (mapping[f] == null && c.length > 1 && opts.mapping?.[f] === undefined) {
      const salesResolved = (f === 'grossSales' && mapping.netSales != null) || (f === 'netSales' && mapping.grossSales != null);
      issues.push({ code: 'ambiguous', field: f, columns: c.map(i => headers[i]), blocking: ['saleDate', 'grossSales', 'netSales', 'orderId'].includes(f) && !salesResolved });
    }
  }
  if (col('saleDate') == null) issues.push({ code: 'missingSaleDate', field: 'saleDate', blocking: true });
  if (col('netSales') == null && col('grossSales') == null && !issues.some(i => i.code === 'ambiguous' && (i.field === 'netSales' || i.field === 'grossSales'))) issues.push({ code: 'missingSales', field: 'netSales', blocking: true });
  if (col('orderId') == null) issues.push({ code: 'missingOrderId', field: 'orderId', blocking: false });
  if (col('payoutDate') == null) issues.push({ code: 'missingPayoutDate', field: 'payoutDate', blocking: false });
  if (col('payout') == null) issues.push({ code: 'missingPayout', field: 'payout', blocking: false });

  // Formato de número e de data
  const moneySample = rows.slice(0, 200).flatMap(r => MONEY_FIELDS.map(f => cell(r, f)).filter((x): x is string => !!x));
  const decimal = opts.decimal ?? detectDecimal(moneySample);
  const dateSample = rows.slice(0, 500).flatMap(r => [cell(r, 'saleDate'), cell(r, 'payoutDate')]).filter((x): x is string => !!x);
  const dd = detectDateOrder(dateSample);
  const dateOrder: DateOrder = opts.dateOrder ?? dd.order ?? preset.dateOrder;
  if (!opts.dateOrder && dd.ambiguous && !dd.order) issues.push({ code: 'dateAmbiguous', blocking: false });

  // Custos exportados como negativos → inverter sinal da coluna
  const flipped: CanonicalField[] = [];
  for (const f of COST_FIELDS) {
    if (col(f) == null) continue;
    const sum = rows.reduce((a, r) => a + (parseMoney(cell(r, f), decimal) || 0), 0);
    if (sum < 0) flipped.push(f);
  }
  if (flipped.length) issues.push({ code: 'signFlipped', columns: flipped.map(f => headers[col(f)!]), blocking: false });

  let badDates = 0, badNumbers = 0;
  const occurrences = new Map<string, number>();
  const records: SalesRecord[] = [];
  for (const r of rows) {
    const num = (f: CanonicalField) => {
      const v = parseMoney(cell(r, f), decimal);
      if (v !== null && Number.isNaN(v)) { badNumbers++; return 0; }
      const n = v ?? 0;
      return flipped.includes(f) ? -n : n;
    };
    const saleDate = parseDate(cell(r, 'saleDate'), dateOrder);
    const payoutDate = parseDate(cell(r, 'payoutDate'), dateOrder);
    if (saleDate === undefined || payoutDate === undefined) badDates++;
    const gross = num('grossSales'), disc = Math.abs(num('discounts')), refunds = Math.abs(num('refunds'));
    let net = col('netSales') != null ? num('netSales') : gross - disc - refunds;
    const kind = kindOf(cell(r, 'kind'), net);
    if (kind === 'refund' && net > 0) net = -net;
    const orderId = (cell(r, 'orderId') ?? '').trim() || null;
    const values = {
      netSales: round2(net), commissions: round2(num('commissions')), promotions: round2(num('promotions')),
      otherFees: round2(num('otherFees')), taxes: round2(num('taxes')), tips: round2(num('tips')),
      adjustments: round2(num('adjustments')),
    };
    const payoutRaw = parseMoney(cell(r, 'payout'), decimal);
    let recordKey: string;
    if (orderId) {
      const base = `${kind}:${orderId}`;
      const n = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, n);
      recordKey = n === 1 ? base : `${base}#${n}`;
    } else {
      recordKey = `row:${fnv1a(JSON.stringify([saleDate, payoutDate, kind, values, payoutRaw, cell(r, 'unit')]))}`;
    }
    records.push(emptyRecord({
      source: opts.source,
      recordKey,
      channel: opts.channel,
      unit: (cell(r, 'unit') || opts.unit || '').trim(),
      kind,
      externalOrderId: orderId,
      saleDate: saleDate ?? null,
      payoutDate: payoutDate ?? null,
      ...values,
      payout: payoutRaw === null || Number.isNaN(payoutRaw) ? null : round2(payoutRaw),
      raw: Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])),
    }));
  }
  if (badDates) issues.push({ code: 'badDates', count: badDates, blocking: badDates === rows.length });
  if (badNumbers) issues.push({ code: 'badNumbers', count: badNumbers, blocking: false });

  const dates = records.map(r => r.saleDate).filter((d): d is string => !!d).sort();
  const totals = sumTotals(records);
  const counts: Record<RecordKind, number> = { order: 0, refund: 0, adjustment: 0, payout: 0 };
  for (const rec of records) counts[rec.kind]++;
  return {
    headers, rows, mapping, candidates: det.candidates, issues, dateOrder, decimal, flipped, records,
    period: { start: dates[0] ?? null, end: dates[dates.length - 1] ?? null },
    // Unidades informadas pelo próprio arquivo (a escolhida manualmente não conta aqui).
    units: col('unit') == null ? [] : [...new Set(rows.map(r => (cell(r, 'unit') ?? '').trim()).filter(Boolean))],
    totals, counts,
  };
}

export function sumTotals(records: SalesRecord[]): Totals {
  const t: Totals = { netSales: 0, commissions: 0, promotions: 0, otherFees: 0, taxes: 0, tips: 0, adjustments: 0, payout: 0 };
  for (const r of records) {
    t.netSales += r.netSales; t.commissions += r.commissions; t.promotions += r.promotions; t.otherFees += r.otherFees;
    t.taxes += r.taxes; t.tips += r.tips; t.adjustments += r.adjustments; t.payout += r.payout ?? 0;
  }
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] = round2(t[k]);
  return t;
}

export const isBlocked = (a: Analysis) => a.issues.some(i => i.blocking);

// Compara o arquivo com o que já existe: novos, atualizados e iguais (reconhecidos).
export function diffExisting(records: SalesRecord[], existing: Map<string, SalesRecord>) {
  let inserted = 0, updated = 0, unchanged = 0;
  const fields: (keyof SalesRecord)[] = ['netSales', 'commissions', 'promotions', 'otherFees', 'taxes', 'tips', 'adjustments', 'payout', 'saleDate', 'payoutDate', 'kind', 'unit'];
  for (const r of records) {
    const e = existing.get(r.recordKey);
    if (!e) inserted++;
    else if (fields.some(f => (e[f] ?? null) !== (r[f] ?? null))) updated++;
    else unchanged++;
  }
  return { inserted, updated, unchanged };
}
