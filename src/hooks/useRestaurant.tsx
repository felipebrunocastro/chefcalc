import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import { setCurrencyValue, type Currency } from '../lib/currency';
import * as repo from '../data/repo';
import type { Restaurant } from '../types';

interface RestaurantContextValue {
  restaurants: Restaurant[];
  dishCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  current: Restaurant | null;
  /** Abre um restaurante (ou volta ao painel com null). Respeita alterações não salvas. */
  select: (id: string | null) => void;
  create: (input: { name: string; currency: Currency; logo?: string | null }) => Promise<Restaurant>;
  update: (id: string, patch: Partial<Pick<Restaurant, 'name' | 'currency' | 'logo' | 'budget' | 'profile' | 'goals'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  /** Telas de edição marcam alterações não salvas aqui. */
  setDirty: (dirty: boolean) => void;
  /** Executa a ação, ou pergunta antes se houver alterações não salvas. */
  guard: (action: () => void) => void;
  /** Acesso compartilhado removido pelo dono enquanto a tela estava aberta. */
  revoked: boolean;
  /** Confere no servidor se o acesso ao restaurante aberto continua valendo. */
  checkAccess: () => Promise<boolean>;
}

const Ctx = createContext<RestaurantContextValue | undefined>(undefined);
const storageKey = (uid: string) => `chefcalc:restaurant:${uid}`;

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dishCounts, setDishCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [revoked, setRevoked] = useState(false);

  const reload = useCallback(async () => {
    if (!user) { setRestaurants([]); setLoading(false); return; }
    try {
      const [list, counts] = await Promise.all([repo.getRestaurants(), repo.getDishCounts()]);
      setRestaurants(list);
      setDishCounts(counts);
      setError(null);
    } catch (e) {
      setError((e as Error).message || 'error');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    setCurrentId(user ? localStorage.getItem(storageKey(user.id)) : null);
    reload();
  }, [user, reload]);

  // Operador sem restaurante próprio e com um único acesso: abre direto o restaurante autorizado.
  // (só uma vez por sessão, para "Trocar cliente" continuar funcionando)
  const autoSelected = useRef(false);
  useEffect(() => {
    if (currentId) { autoSelected.current = true; return; }
    if (loading || !user || autoSelected.current) return;
    const ops = restaurants.filter(r => r.role === 'operator');
    if (ops.length === 1 && restaurants.every(r => r.role !== 'owner')) { autoSelected.current = true; setCurrentId(ops[0].id); }
  }, [loading, currentId, user, restaurants]);

  const current = useMemo(() => restaurants.find(r => r.id === currentId) ?? null, [restaurants, currentId]);
  const role = current?.role;

  const checkAccess = useCallback(async () => {
    if (!currentId || role === 'owner') return true;
    try {
      const list = await repo.getRestaurants();
      const ok = list.some(r => r.id === currentId);
      if (!ok) setRevoked(true);
      return ok;
    } catch { return true; } // falha de rede não é revogação
  }, [currentId, role]);

  // Acesso compartilhado: confere periodicamente (ex.: iPad com o caixa aberto).
  useEffect(() => {
    setRevoked(false);
    if (!currentId || !role || role === 'owner') return;
    const t = window.setInterval(() => { checkAccess(); }, 20000);
    const onVis = () => { if (document.visibilityState === 'visible') checkAccess(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [currentId, role, checkAccess]);

  // A moeda de formatação segue o restaurante aberto (só exibição; valores não mudam).
  if (current) setCurrencyValue(current.currency);

  const doSelect = useCallback((id: string | null) => {
    dirtyRef.current = false;
    setCurrentId(id);
    if (user) {
      if (id) localStorage.setItem(storageKey(user.id), id);
      else localStorage.removeItem(storageKey(user.id));
    }
  }, [user]);

  const guard = useCallback((action: () => void) => {
    if (dirtyRef.current) setPending(() => action);
    else action();
  }, []);

  const select = useCallback((id: string | null) => guard(() => doSelect(id)), [guard, doSelect]);

  const create = useCallback(async (input: { name: string; currency: Currency; logo?: string | null }) => {
    const r = await repo.createRestaurant(input);
    await reload();
    return r;
  }, [reload]);

  const update = useCallback(async (id: string, patch: Partial<Pick<Restaurant, 'name' | 'currency' | 'logo' | 'budget' | 'profile' | 'goals'>>) => {
    await repo.updateRestaurant(id, patch);
    setRestaurants(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await repo.deleteRestaurant(id);
    if (currentId === id) doSelect(null);
    await reload();
  }, [currentId, doSelect, reload]);

  const setDirty = useCallback((d: boolean) => { dirtyRef.current = d; }, []);

  const value: RestaurantContextValue = {
    restaurants, dishCounts, loading, error, current, select, create, update, remove, reload, setDirty, guard, revoked, checkAccess,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h2 id="unsaved-title" className="font-semibold text-slate-900 mb-2">{t('unsaved.title')}</h2>
            <p className="text-sm text-slate-600 mb-5">{t('unsaved.message')}</p>
            <div className="flex gap-2 justify-end">
              <button autoFocus onClick={() => setPending(null)} className="btn-primary">{t('unsaved.keep')}</button>
              <button
                onClick={() => { const a = pending; setPending(null); dirtyRef.current = false; a(); }}
                className="btn-secondary text-red-600"
              >
                {t('unsaved.discard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRestaurant must be used within RestaurantProvider');
  return ctx;
}
