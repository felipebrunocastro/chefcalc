import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronDown, ChevronRight, Download, RefreshCw, Search, ShieldAlert, Store, ClipboardList, Package, Users, UserPlus, Activity } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { navigate } from '../../lib/router';
import { getAdminOverview, isAppAdmin, type AdminOverview, type AdminUser } from '../../data/adminRepo';

type Sort = 'newest' | 'oldest' | 'restaurants' | 'dishes' | 'active';
const SORTS: Sort[] = ['newest', 'oldest', 'restaurants', 'dishes', 'active'];

const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);

export function AdminPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getAdminOverview()); } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await isAppAdmin();
      setAllowed(ok);
      if (ok) load();
    })();
  }, [load]);

  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : t('admin.never'));
  const nf = (n: number) => n.toLocaleString(locale);

  const users = useMemo(() => {
    if (!data) return [] as AdminUser[];
    const term = q.trim().toLowerCase();
    const list = term
      ? data.users.filter(u => u.email?.toLowerCase().includes(term) || u.restaurants.some(r => r.name.toLowerCase().includes(term)))
      : [...data.users];
    const by: Record<Sort, (a: AdminUser, b: AdminUser) => number> = {
      newest: (a, b) => ts(b.createdAt) - ts(a.createdAt),
      oldest: (a, b) => ts(a.createdAt) - ts(b.createdAt),
      restaurants: (a, b) => b.restaurantCount - a.restaurantCount || b.dishCount - a.dishCount,
      dishes: (a, b) => b.dishCount - a.dishCount || b.restaurantCount - a.restaurantCount,
      active: (a, b) => ts(b.lastSignInAt) - ts(a.lastSignInAt),
    };
    return list.sort(by[sort]);
  }, [data, q, sort]);

  const toggle = (id: string) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const exportCsv = () => {
    if (!data) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['email', 'signup', 'last_access', 'confirmed', 'businesses', 'recipe_cards', 'ingredients', 'shared_access', 'business_names'].join(',')];
    for (const u of users) {
      rows.push([u.email, u.createdAt, u.lastSignInAt ?? '', u.confirmed ? 'yes' : 'no', u.restaurantCount, u.dishCount, u.ingredientCount, u.sharedCount, u.restaurants.map(r => r.name).join(' | ')].map(esc).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chefcalc-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const T = data?.totals;
  const kpis = T ? [
    { icon: Users, label: t('admin.kpi.users'), value: nf(T.users), hint: t('admin.kpi.confirmed', { n: nf(T.confirmedUsers) }) },
    { icon: UserPlus, label: t('admin.kpi.new7'), value: nf(T.newUsers7), hint: t('admin.kpi.new30', { n: nf(T.newUsers30) }) },
    { icon: Activity, label: t('admin.kpi.active7'), value: nf(T.active7), hint: t('admin.kpi.activeHint') },
    { icon: Store, label: t('admin.kpi.restaurants'), value: nf(T.restaurants), hint: t('admin.kpi.withRestaurant', { n: nf(T.usersWithRestaurant) }) + (T.deletedRestaurants ? ' · ' + t('admin.kpi.inTrash', { n: nf(T.deletedRestaurants) }) : '') },
    { icon: ClipboardList, label: t('admin.kpi.dishes'), value: nf(T.dishes), hint: t('admin.kpi.perRestaurant', { n: T.restaurants ? (T.dishes / T.restaurants).toLocaleString(locale, { maximumFractionDigits: 1 }) : '0' }) },
    { icon: Package, label: t('admin.kpi.ingredients'), value: nf(T.ingredients), hint: t('admin.kpi.perRestaurant', { n: T.restaurants ? (T.ingredients / T.restaurants).toLocaleString(locale, { maximumFractionDigits: 1 }) : '0' }) },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Logo tone="light" height={24} showIcon={false} />
          <span className="text-xs font-semibold uppercase tracking-wide bg-sky-400/20 text-sky-200 rounded px-2 py-0.5">{t('admin.adminBadge')}</span>
          <div className="flex-1" />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <button onClick={() => navigate('/app')} className="btn-ghost !px-0 text-sm mb-1"><ArrowLeft size={15} /> {t('admin.back')}</button>
            <h1 className="text-2xl md:text-3xl font-bold text-navy-900">{t('admin.title')}</h1>
            <p className="text-slate-600">{t('admin.subtitle')}</p>
          </div>
          {allowed && (
            <div className="flex gap-2">
              <button onClick={load} disabled={loading} className="btn-secondary"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {t('admin.refresh')}</button>
              <button onClick={exportCsv} disabled={!data} className="btn-secondary"><Download size={15} /> {t('admin.export')}</button>
            </div>
          )}
        </div>

        {allowed === null && <p className="text-slate-500" aria-busy="true">{t('admin.loading')}</p>}

        {allowed === false && (
          <div className="card p-5 flex gap-3 border-amber-300 bg-amber-50 text-amber-900" role="alert">
            <ShieldAlert className="shrink-0" />
            <div><p className="font-semibold">{t('admin.denied')}</p><p className="text-sm mt-1">{t('admin.deniedHint')}</p></div>
          </div>
        )}

        {error && <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm" role="alert">{t('admin.error', { msg: error })}</div>}

        {data && (
          <>
            <section aria-label={t('admin.title')} className="grid grid-cols-2 lg:grid-cols-3 gap-3" data-testid="admin-kpis">
              {kpis.map(k => (
                <div key={k.label} className="card p-4">
                  <div className="flex items-center gap-2 text-slate-500 text-sm"><k.icon size={16} className="text-blue-600" /> {k.label}</div>
                  <div className="text-3xl font-bold text-navy-900 mt-1 tabular-nums">{k.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{k.hint}</div>
                </div>
              ))}
            </section>

            <section className="card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.search')} aria-label={t('admin.search')} className="field !pl-9" />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  {t('admin.sort')}
                  <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="field !w-auto">
                    {SORTS.map(s => <option key={s} value={s}>{t(`admin.sorts.${s}`)}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-xs text-slate-500">
                {t('admin.count', { n: nf(users.length), total: nf(data.users.length) })} · {t('admin.updatedAt', { time: new Date(data.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
              </p>

              {users.length === 0 ? <p className="text-slate-500 py-6 text-center">{t('admin.empty')}</p> : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm" data-testid="admin-table">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-2 pr-2 font-medium">{t('admin.col.email')}</th>
                          <th className="py-2 px-2 font-medium">{t('admin.col.signup')}</th>
                          <th className="py-2 px-2 font-medium">{t('admin.col.lastSeen')}</th>
                          <th className="py-2 px-2 font-medium text-right">{t('admin.col.restaurants')}</th>
                          <th className="py-2 px-2 font-medium text-right">{t('admin.col.dishes')}</th>
                          <th className="py-2 px-2 font-medium text-right">{t('admin.col.ingredients')}</th>
                          <th className="py-2 pl-2 font-medium text-right">{t('admin.col.shared')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => {
                          const isOpen = open.has(u.id);
                          return [
                            <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2 pr-2">
                                <button onClick={() => toggle(u.id)} aria-expanded={isOpen} aria-label={isOpen ? t('admin.hideBusinesses') : t('admin.showBusinesses', { email: u.email })} className="inline-flex items-center gap-1.5 text-left text-navy-900 font-medium hover:text-blue-700">
                                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                  <span className="break-all">{u.email}</span>
                                </button>
                                {u.isAdmin && <span className="ml-2 text-[10px] font-bold uppercase bg-sky-100 text-sky-800 rounded px-1.5 py-0.5">{t('admin.adminBadge')}</span>}
                                {!u.confirmed && <span className="ml-2 text-[10px] font-medium bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">{t('admin.unconfirmed')}</span>}
                              </td>
                              <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{date(u.createdAt)}</td>
                              <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{date(u.lastSignInAt)}</td>
                              <td className="py-2 px-2 text-right tabular-nums font-semibold">{nf(u.restaurantCount)}</td>
                              <td className="py-2 px-2 text-right tabular-nums font-semibold">{nf(u.dishCount)}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{nf(u.ingredientCount)}</td>
                              <td className="py-2 pl-2 text-right tabular-nums">{nf(u.sharedCount)}</td>
                            </tr>,
                            isOpen && (
                              <tr key={u.id + '-biz'} className="bg-blue-50/40">
                                <td colSpan={7} className="py-2 pl-7 pr-2"><BizList u={u} date={date} /></td>
                              </tr>
                            ),
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Celular */}
                  <ul className="md:hidden space-y-2">
                    {users.map(u => {
                      const isOpen = open.has(u.id);
                      return (
                        <li key={u.id} className="border border-slate-200 rounded-xl p-3">
                          <button onClick={() => toggle(u.id)} aria-expanded={isOpen} className="w-full text-left">
                            <div className="flex items-start gap-1.5 font-medium text-navy-900">
                              {isOpen ? <ChevronDown size={15} className="mt-0.5 shrink-0" /> : <ChevronRight size={15} className="mt-0.5 shrink-0" />}
                              <span className="break-all">{u.email}</span>
                            </div>
                            <div className="text-xs text-slate-500 ml-5">{t('admin.col.signup')}: {date(u.createdAt)} · {t('admin.col.lastSeen')}: {date(u.lastSignInAt)}</div>
                            <div className="grid grid-cols-3 gap-2 mt-2 ml-5 text-center">
                              <div><div className="text-lg font-bold tabular-nums">{nf(u.restaurantCount)}</div><div className="text-[11px] text-slate-500">{t('admin.col.restaurants')}</div></div>
                              <div><div className="text-lg font-bold tabular-nums">{nf(u.dishCount)}</div><div className="text-[11px] text-slate-500">{t('admin.col.dishes')}</div></div>
                              <div><div className="text-lg font-bold tabular-nums">{nf(u.ingredientCount)}</div><div className="text-[11px] text-slate-500">{t('admin.col.ingredients')}</div></div>
                            </div>
                          </button>
                          {isOpen && <div className="mt-2 ml-5"><BizList u={u} date={date} /></div>}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function BizList({ u, date }: { u: AdminUser; date: (s: string | null) => string }) {
  const { t } = useTranslation();
  if (u.restaurants.length === 0) return <p className="text-sm text-slate-500">{t('admin.noBusinesses')}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {u.restaurants.map(r => (
        <li key={r.id} className="flex flex-wrap gap-x-2">
          <Store size={14} className="text-blue-600 mt-0.5" />
          <span className={`font-medium ${r.deletedAt ? 'text-slate-400 line-through' : 'text-navy-900'}`}>{r.name}</span>
          {r.deletedAt && <span className="text-[10px] font-semibold uppercase bg-red-100 text-red-700 rounded px-1.5 py-0.5">{t('admin.inTrashBadge')}</span>}
          <span className="text-slate-600">{t('admin.bizLine', { dishes: r.dishes, ingredients: r.ingredients, members: r.members })}</span>
          <span className="text-slate-400">· {t('admin.createdOn', { date: date(r.createdAt) })}</span>
        </li>
      ))}
    </ul>
  );
}
