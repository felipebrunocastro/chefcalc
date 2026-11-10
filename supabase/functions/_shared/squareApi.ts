// Utilitários das Edge Functions do Square (Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.0';

export const SQUARE_SCOPES = ['MERCHANT_PROFILE_READ', 'ORDERS_READ', 'PAYMENTS_READ', 'PAYOUTS_READ']; // somente leitura
export const squareBase = () => (Deno.env.get('SQUARE_ENV') === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com');
export const squareVersion = () => Deno.env.get('SQUARE_VERSION') ?? '2024-12-18';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const serviceClient = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

export function userClient(req: Request): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
  });
}

export async function squareFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${squareBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Square-Version': squareVersion(), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Square ${res.status}: ${JSON.stringify(body?.errors ?? body).slice(0, 300)}`);
  return body;
}

// Estado do OAuth assinado com HMAC (evita CSRF e troca de restaurante).
const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('OAUTH_STATE_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
export async function signState(payload: Record<string, unknown>) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}
export async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig || (await hmac(body)) !== sig) return null;
  const p = JSON.parse(fromB64url(body));
  return typeof p.exp === 'number' && p.exp > Date.now() ? p : null;
}
