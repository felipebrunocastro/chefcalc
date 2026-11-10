// Conexão oficial com o Square via OAuth, somente leitura.
// Deploy: supabase functions deploy square-oauth --no-verify-jwt
//   (o retorno do Square chega sem token do Supabase; as ações POST validam o usuário aqui dentro)
// Secrets: SQUARE_APPLICATION_ID, SQUARE_APPLICATION_SECRET, SQUARE_ENV (production|sandbox),
//          OAUTH_STATE_SECRET, APP_URL (ex.: https://chefcalc.vercel.app)
import { SQUARE_SCOPES, cors, json, serviceClient, signState, squareBase, squareFetch, userClient, verifyState } from '../_shared/squareApi.ts';

const APP_ID = Deno.env.get('SQUARE_APPLICATION_ID')!;
const APP_SECRET = Deno.env.get('SQUARE_APPLICATION_SECRET')!;
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
const callbackUrl = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-oauth`;

async function ownerOf(req: Request, restaurantId: string) {
  const supa = userClient(req);
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data } = await supa.from('restaurants').select('id').eq('id', restaurantId).eq('user_id', user.id).maybeSingle();
  return data ? user : null;
}

const back = (ret: string, status: string) => {
  const safe = ret && APP_URL && ret.startsWith(APP_URL) ? ret : `${APP_URL}/app`;
  const u = new URL(safe);
  u.searchParams.set('integration', 'square');
  u.searchParams.set('status', status);
  return Response.redirect(u.toString(), 302);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);

  // ---- Retorno do Square ----
  if (req.method === 'GET') {
    const state = await verifyState(url.searchParams.get('state') ?? '');
    if (!state) return back('', 'invalid_state');
    const ret = String(state.ret ?? '');
    if (url.searchParams.get('error') || !url.searchParams.get('code')) return back(ret, 'denied');
    try {
      const tokenRes = await fetch(`${squareBase()}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: APP_ID, client_secret: APP_SECRET, code: url.searchParams.get('code'), grant_type: 'authorization_code', redirect_uri: callbackUrl() }),
      });
      const tok = await tokenRes.json();
      if (!tokenRes.ok || !tok.access_token) throw new Error(JSON.stringify(tok).slice(0, 200));
      const restaurantId = String(state.r);
      const admin = serviceClient();
      await admin.from('integration_secrets').upsert({
        restaurant_id: restaurantId, provider: 'square', access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? null, expires_at: tok.expires_at ?? null, updated_at: new Date().toISOString(),
      });
      const loc = await squareFetch('/v2/locations', tok.access_token);
      await admin.from('integrations').upsert({
        restaurant_id: restaurantId, provider: 'square', status: 'connected', merchant_id: tok.merchant_id ?? null,
        locations: (loc.locations ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
        scopes: SQUARE_SCOPES, connected_at: new Date().toISOString(), last_error: null,
      });
      return back(ret, 'connected');
    } catch (e) {
      await serviceClient().from('integrations').upsert({ restaurant_id: String(state.r), provider: 'square', status: 'error', last_error: String(e).slice(0, 300) });
      return back(ret, 'error');
    }
  }

  // ---- Ações do app ----
  const body = await req.json().catch(() => ({}));
  const restaurantId = String(body.restaurantId ?? '');
  const user = await ownerOf(req, restaurantId);
  if (!user) return json({ error: 'Somente o dono do restaurante pode conectar o Square.' }, 403);

  if (body.action === 'start') {
    if (!APP_ID || !APP_SECRET) return json({ error: 'Square não configurado no servidor (SQUARE_APPLICATION_ID / SECRET).' }, 500);
    const state = await signState({ r: restaurantId, u: user.id, ret: String(body.returnUrl ?? ''), exp: Date.now() + 10 * 60_000, n: crypto.randomUUID() });
    const auth = new URL(`${squareBase()}/oauth2/authorize`);
    auth.searchParams.set('client_id', APP_ID);
    auth.searchParams.set('scope', SQUARE_SCOPES.join(' '));
    auth.searchParams.set('session', 'false');
    auth.searchParams.set('state', state);
    auth.searchParams.set('redirect_uri', callbackUrl());
    return json({ url: auth.toString() });
  }

  if (body.action === 'disconnect') {
    const admin = serviceClient();
    const { data: sec } = await admin.from('integration_secrets').select('access_token').eq('restaurant_id', restaurantId).eq('provider', 'square').maybeSingle();
    if (sec?.access_token) {
      await fetch(`${squareBase()}/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Client ${APP_SECRET}` },
        body: JSON.stringify({ client_id: APP_ID, access_token: sec.access_token }),
      }).catch(() => null);
    }
    await admin.from('integration_secrets').delete().eq('restaurant_id', restaurantId).eq('provider', 'square');
    await admin.from('integrations').update({ status: 'disconnected' }).eq('restaurant_id', restaurantId).eq('provider', 'square');
    return json({ ok: true });
  }

  return json({ error: 'Ação inválida' }, 400);
});
