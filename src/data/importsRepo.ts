import { supabase } from '../lib/supabase';
import type { SalesRecord } from '../lib/imports/normalize';

// Dados importados ficam em tabelas próprias (sales_records / import_batches),
// separados do orçamento e dos custos manuais.

interface RecordRow {
  source: string; record_key: string; channel: string; unit: string; kind: SalesRecord['kind'];
  external_order_id: string | null; external_ref: string | null; source_name: string | null;
  sale_date: string | null; payout_date: string | null;
  net_sales: number | string; commissions: number | string; promotions: number | string; other_fees: number | string;
  taxes: number | string; tips: number | string; adjustments: number | string; payout: number | string | null;
  currency: string | null; match_status: SalesRecord['matchStatus']; matched_source: string | null; matched_key: string | null;
  batch_id: string | null; imported_at: string; raw?: Record<string, unknown> | null;
}

const n = (v: number | string | null) => (v === null ? 0 : Number(v));

export const fromRow = (r: RecordRow): SalesRecord => ({
  source: r.source, recordKey: r.record_key, channel: r.channel, unit: r.unit, kind: r.kind,
  externalOrderId: r.external_order_id, externalRef: r.external_ref, sourceName: r.source_name,
  saleDate: r.sale_date, payoutDate: r.payout_date,
  netSales: n(r.net_sales), commissions: n(r.commissions), promotions: n(r.promotions), otherFees: n(r.other_fees),
  taxes: n(r.taxes), tips: n(r.tips), adjustments: n(r.adjustments), payout: r.payout === null ? null : Number(r.payout),
  currency: r.currency, matchStatus: r.match_status, matchedSource: r.matched_source, matchedKey: r.matched_key,
  batchId: r.batch_id, importedAt: r.imported_at, raw: r.raw ?? null,
});

const toRow = (restaurantId: string, r: SalesRecord, batchId?: string | null) => ({
  restaurant_id: restaurantId, source: r.source, record_key: r.recordKey, channel: r.channel, unit: r.unit, kind: r.kind,
  external_order_id: r.externalOrderId, external_ref: r.externalRef, source_name: r.sourceName,
  sale_date: r.saleDate, payout_date: r.payoutDate,
  net_sales: r.netSales, commissions: r.commissions, promotions: r.promotions, other_fees: r.otherFees,
  taxes: r.taxes, tips: r.tips, adjustments: r.adjustments, payout: r.payout, currency: r.currency,
  match_status: r.matchStatus, matched_source: r.matchedSource, matched_key: r.matchedKey,
  batch_id: batchId ?? r.batchId ?? null, raw: r.raw ?? null, updated_at: new Date().toISOString(),
});

export async function getSalesRecords(restaurantId: string): Promise<SalesRecord[]> {
  const out: SalesRecord[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('sales_records').select('*').eq('restaurant_id', restaurantId).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []).map(r => fromRow(r as RecordRow)));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function upsertSalesRecords(restaurantId: string, records: SalesRecord[], batchId?: string | null): Promise<void> {
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500).map(r => toRow(restaurantId, r, batchId));
    const { error } = await supabase.from('sales_records').upsert(chunk, { onConflict: 'restaurant_id,source,record_key' });
    if (error) throw error;
  }
}

export interface ImportBatch {
  id: string; source: string; channel: string; unit: string; fileName: string | null; fileHash: string | null;
  periodStart: string | null; periodEnd: string | null; rowCount: number; inserted: number; updated: number;
  summary: Record<string, unknown>; mapping: Record<string, unknown>; createdAt: string; updatedAt: string;
}

interface BatchRow {
  id: string; source: string; channel: string; unit: string; file_name: string | null; file_hash: string | null;
  period_start: string | null; period_end: string | null; row_count: number; inserted: number; updated: number;
  summary: Record<string, unknown>; mapping: Record<string, unknown>; created_at: string; updated_at: string;
}
const batchFromRow = (b: BatchRow): ImportBatch => ({
  id: b.id, source: b.source, channel: b.channel, unit: b.unit, fileName: b.file_name, fileHash: b.file_hash,
  periodStart: b.period_start, periodEnd: b.period_end, rowCount: b.row_count, inserted: b.inserted, updated: b.updated,
  summary: b.summary ?? {}, mapping: b.mapping ?? {}, createdAt: b.created_at, updatedAt: b.updated_at,
});

export async function getBatches(restaurantId: string): Promise<ImportBatch[]> {
  const { data, error } = await supabase.from('import_batches').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(b => batchFromRow(b as BatchRow));
}

// Mesmo arquivo (hash) → atualiza o lote existente em vez de criar outro.
export async function saveBatch(restaurantId: string, b: Omit<ImportBatch, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string): Promise<string> {
  const row = {
    restaurant_id: restaurantId, source: b.source, channel: b.channel, unit: b.unit, file_name: b.fileName, file_hash: b.fileHash,
    period_start: b.periodStart, period_end: b.periodEnd, row_count: b.rowCount, inserted: b.inserted, updated: b.updated,
    summary: b.summary, mapping: b.mapping, updated_at: new Date().toISOString(),
  };
  if (existingId) {
    const { error } = await supabase.from('import_batches').update(row).eq('id', existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await supabase.from('import_batches').insert(row).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// Mapeamento usado por último em cada fonte (reaproveitado na próxima importação).
export async function lastMapping(restaurantId: string, source: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase.from('import_batches').select('mapping').eq('restaurant_id', restaurantId).eq('source', source)
    .order('created_at', { ascending: false }).limit(1);
  return (data?.[0] as { mapping?: Record<string, unknown> } | undefined)?.mapping ?? null;
}

// ---------- Conexões ----------

export interface Integration {
  provider: string; status: 'connected' | 'disconnected' | 'error'; merchantId: string | null;
  locations: { id: string; name: string }[]; connectedAt: string | null; lastSyncAt: string | null; lastError: string | null;
}

export async function getIntegrations(restaurantId: string): Promise<Integration[]> {
  const { data, error } = await supabase.from('integrations').select('*').eq('restaurant_id', restaurantId);
  if (error) throw error;
  return (data ?? []).map(r => ({
    provider: r.provider, status: r.status, merchantId: r.merchant_id, locations: r.locations ?? [],
    connectedAt: r.connected_at, lastSyncAt: r.last_sync_at, lastError: r.last_error,
  }));
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String(data.error));
  return data as T;
}

export const squareConnectUrl = (restaurantId: string, returnUrl: string) =>
  invoke<{ url: string }>('square-oauth', { action: 'start', restaurantId, returnUrl });
export const squareDisconnect = (restaurantId: string) => invoke<{ ok: boolean }>('square-oauth', { action: 'disconnect', restaurantId });
export const squareSync = (restaurantId: string, start: string, end: string) =>
  invoke<{ inserted: number; updated: number; orders: number; payouts: number }>('square-sync', { restaurantId, start, end });
