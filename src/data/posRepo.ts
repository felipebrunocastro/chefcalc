import { supabase } from '../lib/supabase';
import type { CashMovement, CashSession, ChannelSummary, Payment, PosProduct, PosSale, SaleEvent, SaleItem } from '../lib/pos/types';

// Caixa e Vendas. Permissões aplicadas no banco (migração 006): o operador só grava
// no restaurante/unidade autorizados; revogado, nenhuma escrita passa.

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const sessionFrom = (r: Row): CashSession => ({
  id: r.id, unit: r.unit ?? '', opDate: r.op_date, shift: r.shift ?? '', responsible: r.responsible ?? '', openingCash: num(r.opening_cash),
  status: r.status, openedAt: r.opened_at, openedBy: r.opened_by, closedAt: r.closed_at, closedBy: r.closed_by,
  countedCash: numOrNull(r.counted_cash), expectedCash: numOrNull(r.expected_cash), difference: numOrNull(r.difference), corrections: r.corrections ?? [],
});
const saleFrom = (r: Row): PosSale => ({
  id: r.id, sessionId: r.session_id, unit: r.unit ?? '', opDate: r.op_date, code: r.code, clientToken: r.client_token,
  channel: r.channel, payment: r.payment, items: r.items ?? [], subtotal: num(r.subtotal), discount: num(r.discount), tax: num(r.tax),
  total: num(r.total), received: numOrNull(r.received), change: numOrNull(r.change), status: r.status, createdAt: r.created_at, createdBy: r.created_by,
});
const eventFrom = (r: Row): SaleEvent => ({ id: r.id, saleId: r.sale_id, sessionId: r.session_id, kind: r.kind, amount: num(r.amount), cash: !!r.cash, reason: r.reason, responsible: r.responsible ?? '', createdAt: r.created_at });
const moveFrom = (r: Row): CashMovement => ({ id: r.id, sessionId: r.session_id, kind: r.kind, amount: num(r.amount), reason: r.reason, responsible: r.responsible ?? '', createdAt: r.created_at });
const summaryFrom = (r: Row): ChannelSummary => ({
  id: r.id, unit: r.unit ?? '', opDate: r.op_date, channel: r.channel, sourceName: r.source_name, includes: r.includes ?? {},
  grossSales: num(r.gross_sales), orders: r.orders === null || r.orders === undefined ? null : Number(r.orders), discounts: num(r.discounts), refunds: num(r.refunds),
  fees: num(r.fees), payout: numOrNull(r.payout), payoutDate: r.payout_date, status: r.status, overlapResolution: r.overlap_resolution,
  createdAt: r.created_at, createdByEmail: r.created_by_email,
});
const productFrom = (r: Row): PosProduct => ({
  id: r.id, name: r.name, category: r.category ?? '', price: num(r.price), dishId: r.dish_id, sizes: r.sizes ?? [], addons: r.addons ?? [],
  taxPct: numOrNull(r.tax_pct), active: r.active !== false, sort: r.sort ?? 0,
});

async function all(table: string, rid: string, from?: string, to?: string, dateCol = 'op_date'): Promise<Row[]> {
  let q = supabase.from(table).select('*').eq('restaurant_id', rid);
  if (from) q = q.gte(dateCol, from);
  if (to) q = q.lte(dateCol, to);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export interface PosData { sessions: CashSession[]; sales: PosSale[]; events: SaleEvent[]; movements: CashMovement[]; summaries: ChannelSummary[]; products: PosProduct[] }

export async function loadPos(rid: string): Promise<PosData> {
  const [s, v, e, m, c, p] = await Promise.all([
    all('cash_sessions', rid), all('pos_sales', rid), all('pos_sale_events', rid), all('cash_movements', rid), all('channel_summaries', rid), all('pos_products', rid),
  ]);
  return {
    sessions: s.map(sessionFrom), sales: v.map(saleFrom), events: e.map(eventFrom), movements: m.map(moveFrom),
    summaries: c.map(summaryFrom), products: p.map(productFrom).sort((a, b) => a.category.localeCompare(b.category) || a.sort - b.sort || a.name.localeCompare(b.name)),
  };
}

export async function openSession(rid: string, v: { unit: string; opDate: string; shift: string; responsible: string; openingCash: number }): Promise<CashSession> {
  const { data, error } = await supabase.from('cash_sessions').insert({
    restaurant_id: rid, unit: v.unit, op_date: v.opDate, shift: v.shift, responsible: v.responsible, opening_cash: v.openingCash,
  }).select('*').single();
  if (error) throw error;
  return sessionFrom(data as Row);
}

export async function closeSession(id: string, counted: number): Promise<CashSession> {
  const { data, error } = await supabase.from('cash_sessions').update({ status: 'closed', counted_cash: counted }).eq('id', id).select('*').single();
  if (error) throw error;
  return sessionFrom(data as Row);
}

export async function correctSession(id: string, counted: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('correct_closed_session', { session_id: id, new_counted: counted, reason });
  if (error) throw error;
}

export interface NewSale {
  sessionId: string; opDate: string; code: string; clientToken: string; items: SaleItem[];
  subtotal: number; discount: number; tax: number; total: number; received: number | null; change: number | null; payment?: Payment;
}

// Idempotente: a mesma client_token nunca gera duas vendas (toque repetido, rede lenta, nova tentativa).
export async function recordSale(rid: string, v: NewSale): Promise<PosSale> {
  const { data, error } = await supabase.from('pos_sales').insert({
    restaurant_id: rid, session_id: v.sessionId, op_date: v.opDate, code: v.code, client_token: v.clientToken, items: v.items,
    subtotal: v.subtotal, discount: v.discount, tax: v.tax, total: v.total, received: v.received, change: v.change, payment: v.payment ?? 'cash', channel: 'counter',
  }).select('*').single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase.from('pos_sales').select('*').eq('restaurant_id', rid).eq('client_token', v.clientToken).maybeSingle();
      if (existing) return saleFrom(existing as Row);
    }
    throw error;
  }
  return saleFrom(data as Row);
}

export async function saleEvent(rid: string, v: { saleId: string; kind: 'cancel' | 'refund'; amount?: number; cash?: boolean; sessionId?: string | null; reason: string; responsible: string }) {
  const { error } = await supabase.from('pos_sale_events').insert({
    restaurant_id: rid, sale_id: v.saleId, kind: v.kind, amount: v.amount ?? 0, cash: v.cash ?? true, session_id: v.sessionId ?? null, reason: v.reason, responsible: v.responsible,
  });
  if (error) throw error;
}

export async function addMovement(rid: string, v: { sessionId: string; kind: CashMovement['kind']; amount: number; reason: string; responsible: string }) {
  const { error } = await supabase.from('cash_movements').insert({ restaurant_id: rid, session_id: v.sessionId, kind: v.kind, amount: v.amount, reason: v.reason, responsible: v.responsible });
  if (error) throw error;
}

export async function addSummary(rid: string, v: Omit<ChannelSummary, 'id' | 'status' | 'overlapResolution' | 'createdAt' | 'createdByEmail'>) {
  const { error } = await supabase.from('channel_summaries').insert({
    restaurant_id: rid, unit: v.unit, op_date: v.opDate, channel: v.channel, source_name: v.sourceName, includes: v.includes,
    gross_sales: v.grossSales, orders: v.orders, discounts: v.discounts, refunds: v.refunds, fees: v.fees, payout: v.payout, payout_date: v.payoutDate,
  });
  if (error) throw error;
}

export async function updateSummary(id: string, patch: { status?: ChannelSummary['status']; overlapResolution?: ChannelSummary['overlapResolution'] }, note: string) {
  const { data: cur } = await supabase.from('channel_summaries').select('history').eq('id', id).maybeSingle();
  const { data: u } = await supabase.auth.getUser();
  const history = [...((cur?.history as unknown[]) ?? []), { at: new Date().toISOString(), by: u.user?.email ?? null, note, ...patch }];
  const row: Row = { history };
  if (patch.status) row.status = patch.status;
  if (patch.overlapResolution !== undefined) row.overlap_resolution = patch.overlapResolution;
  const { error } = await supabase.from('channel_summaries').update(row).eq('id', id);
  if (error) throw error;
}

// ---------- Catálogo (somente dono) ----------
export async function saveProduct(rid: string, p: Partial<PosProduct> & { name: string; price: number }) {
  const row: Row = {
    restaurant_id: rid, name: p.name.trim(), category: (p.category ?? '').trim(), price: p.price, dish_id: p.dishId ?? null,
    sizes: p.sizes ?? [], addons: p.addons ?? [], tax_pct: p.taxPct ?? null, active: p.active ?? true, sort: p.sort ?? 0, updated_at: new Date().toISOString(),
  };
  const { error } = p.id
    ? await supabase.from('pos_products').update(row).eq('id', p.id)
    : await supabase.from('pos_products').insert(row);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('pos_products').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Equipe e convites ----------
export interface TeamMember { email: string; role: 'viewer' | 'finance' | 'operator'; status: 'pending' | 'active'; unit: string | null; invitedAt: string | null; acceptedAt: string | null; expiresAt: string | null }

export async function getTeam(rid: string): Promise<TeamMember[]> {
  const { data, error } = await supabase.from('restaurant_members').select('*').eq('restaurant_id', rid);
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({ email: r.email, role: r.role, status: r.status ?? 'active', unit: r.unit ?? null, invitedAt: r.invited_at ?? r.created_at ?? null, acceptedAt: r.accepted_at ?? null, expiresAt: r.expires_at ?? null }));
}

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const newToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

// Cria (ou renova) o convite e devolve o link. O token só existe no link; o banco guarda o hash.
export async function inviteMember(rid: string, email: string, role: TeamMember['role'], unit: string | null): Promise<string> {
  const token = newToken();
  const { error } = await supabase.from('restaurant_members').upsert({
    restaurant_id: rid, email: email.trim().toLowerCase(), role, unit: unit || null, status: 'pending',
    token_hash: await sha256Hex(token), invited_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), user_id: null, accepted_at: null,
  });
  if (error) throw error;
  return `${window.location.origin}/convite?token=${token}`;
}

export async function removeMember(rid: string, email: string) {
  const { error } = await supabase.from('restaurant_members').delete().eq('restaurant_id', rid).eq('email', email);
  if (error) throw error;
}

export async function inviteInfo(token: string): Promise<{ restaurantName: string; unit: string | null; role: string; email: string; expired: boolean } | null> {
  const { data, error } = await supabase.rpc('invite_info', { token });
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  return r ? { restaurantName: r.restaurant_name, unit: r.unit, role: r.role, email: r.email, expired: !!r.expired } : null;
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', { token });
  if (error) throw error;
  return data as string;
}

export async function myMembership(rid: string): Promise<{ role: string; unit: string | null } | null> {
  const { data: u } = await supabase.auth.getUser();
  const email = (u.user?.email ?? '').toLowerCase();
  const { data } = await supabase.from('restaurant_members').select('role, unit, status, user_id').eq('restaurant_id', rid).eq('email', email);
  const row = (data ?? []).find((r: Row) => r.status === 'active');
  return row ? { role: row.role, unit: row.unit ?? null } : null;
}
