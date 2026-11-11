import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { isAppAdmin } from '../../data/adminRepo';
import { navigate } from '../../lib/router';
import { useRestaurant } from '../../hooks/useRestaurant';
import { Mascot } from '../ui/Mascot';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RestaurantForm } from './RestaurantForm';
import { RestaurantLogo } from './RestaurantLogo';
import type { Restaurant } from '../../types';

export function RestaurantsPanel() {
  const { t } = useTranslation();
  const { restaurants, dishCounts, loading, error, select, create, update, remove } = useRestaurant();
  const [form, setForm] = useState<{ edit?: Restaurant } | null>(null);
  const [toDelete, setToDelete] = useState<Restaurant | null>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => { let on = true; isAppAdmin().then(ok => { if (on) setAdmin(ok); }); return () => { on = false; }; }, []);
  const own = restaurants.filter(r => r.role === 'owner');
  const shared = restaurants.filter(r => r.role !== 'owner');

  const CardGrid = ({ list }: { list: Restaurant[] }) => (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map(r => (
        <li key={r.id} className="card group relative hover:border-blue-300 hover:shadow-md">
          <button
            onClick={() => select(r.id)}
            className="w-full text-left p-5 flex items-center gap-4 rounded-2xl"
            aria-label={`${t('restaurants.open')} ${r.name}`}
          >
            <RestaurantLogo restaurant={r} size={60} />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-navy-900 truncate pr-8">{r.name}</span>
              <span className="block text-sm text-slate-500">{t('restaurants.sheets', { count: dishCounts[r.id] || 0 })}</span>
              {r.role === 'owner'
                ? <span className="block text-xs text-slate-400 mt-0.5">{r.currency}</span>
                : <span className="inline-block text-[11px] font-semibold text-blue-800 bg-blue-100 rounded-full px-2 py-0.5 mt-1">{t(`roles.${r.role}`)}</span>}
            </span>
            <ChevronRight size={18} className="text-blue-400 group-hover:text-blue-700" />
          </button>
          {r.role === 'owner' && (
            <button
              onClick={() => setForm({ edit: r })}
              className="btn-ghost absolute top-3 right-3"
              aria-label={`${t('restaurants.edit')}: ${r.name}`}
              title={t('restaurants.edit')}
            >
              <Pencil size={15} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <section className="card p-5 md:p-7 mb-6 flex flex-col sm:flex-row items-center gap-5 bg-gradient-to-br from-white to-blue-50">
        <Mascot size={150} />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-navy-900">{t('restaurants.title')}</h1>
          <p className="text-slate-600 mt-1">{t('restaurants.welcome')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => setForm({})} className="btn-primary">
            <Plus size={16} /> {t('restaurants.add')}
          </button>
          {admin && <button onClick={() => navigate('/admin')} className="btn-secondary"><ShieldCheck size={16} /> {t('admin.open')}</button>}
        </div>
      </section>

      {error && (
        <div className="card p-4 mb-6 border-red-200 bg-red-50 text-sm text-red-700 flex gap-2" role="alert">
          <AlertTriangle size={18} className="shrink-0" />
          <div><p className="font-medium">{t('restaurants.loadError')}</p><p>{t('restaurants.migrationHint')}</p><p className="text-xs mt-1 opacity-70">{error}</p></div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map(i => <div key={i} className="card h-28 animate-pulse bg-blue-50" />)}
        </div>
      ) : own.length === 0 && shared.length === 0 && !error ? (
        <div className="card p-10 text-center flex flex-col items-center gap-3">
          <Mascot size={96} decorative />
          <p className="text-slate-600">{t('restaurants.empty')}</p>
          <button onClick={() => setForm({})} className="btn-primary"><Plus size={16} /> {t('restaurants.add')}</button>
        </div>
      ) : (
        <>
          {own.length > 0 && <CardGrid list={own} />}
          {shared.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">{t('restaurants.sharedWithMe')}</h2>
              <CardGrid list={shared} />
            </>
          )}
        </>
      )}

      {form && (
        <RestaurantForm
          initial={form.edit}
          onCancel={() => setForm(null)}
          onDelete={form.edit ? () => { setToDelete(form.edit!); setForm(null); } : undefined}
          onSubmit={async v => {
            if (form.edit) await update(form.edit.id, v);
            else { const r = await create(v); setForm(null); select(r.id); return; }
            setForm(null);
          }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          message={t('restaurants.confirmDelete')}
          onCancel={() => setToDelete(null)}
          onConfirm={async () => { await remove(toDelete.id); setToDelete(null); }}
        />
      )}
    </div>
  );
}
