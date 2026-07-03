import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Edit2, Trash2, ChefHat, Copy } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDishes } from '../../hooks/useDishes';
import { useIngredients } from '../../hooks/useIngredients';
import { calcDish, formatCurrency, formatPct } from '../../utils/calculations';
import { MarginBadge } from '../ui/MarginBadge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { AppView, Dish } from '../../types';

interface Props {
  onNavigate: (view: AppView, dishId?: string) => void;
}

export function Dashboard({ onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const { dishes, loading, save, remove } = useDishes();
  const { ingredients } = useIngredients();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Dish | null>(null);
  const lang = i18n.language as 'pt' | 'en' | 'es';

  const duplicate = async (dish: Dish) => {
    const now = Date.now();
    const suffix = ` (${t('dashboard.copySuffix')})`;
    const copy: Dish = {
      ...dish,
      id: uuidv4(),
      nome: {
        pt: dish.nome.pt + suffix,
        en: dish.nome.en + suffix,
        es: dish.nome.es + suffix,
      },
      createdAt: now,
      updatedAt: now,
    };
    await save(copy);
  };

  const categories = useMemo(() => {
    const cats = new Set(dishes.map(d => d.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [dishes]);

  const filtered = useMemo(() => {
    return dishes.filter(d => {
      const name = d.nome[lang] || d.nome.pt;
      const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
      const matchesCat = !category || d.categoria === category;
      return matchesSearch && matchesCat;
    });
  }, [dishes, search, category, lang]);

  const calculated = useMemo(() =>
    filtered.map(d => calcDish(d, ingredients)),
    [filtered, ingredients]
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      {t('common.loading')}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <button
          onClick={() => onNavigate('dish')}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <Plus size={16} />
          {t('nav.newDish')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('dashboard.search')}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white min-w-[140px]"
          >
            <option value="">{t('dashboard.allCategories')}</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {calculated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ChefHat size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-400 mb-4">{t('dashboard.noDishes')}</p>
          <button
            onClick={() => onNavigate('dish')}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
          >
            <Plus size={16} />
            {t('dashboard.addFirst')}
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('dish.name')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('dish.category')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('dashboard.costPerPortion')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('dashboard.salePrice')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('dashboard.cmv')}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">{t('dashboard.margin')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {calculated.map(({ dish, custoTotalPorcao, precoVendaSugerido, cmvPct, margemStatus }) => (
                  <tr key={dish.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{dish.nome[lang] || dish.nome.pt}</div>
                      <div className="text-xs text-gray-400">{dish.rendimentoPorcoes} {t('dashboard.portions', { n: dish.rendimentoPorcoes, count: dish.rendimentoPorcoes })}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dish.categoria || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(custoTotalPorcao)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{formatCurrency(precoVendaSugerido)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">{formatPct(cmvPct)}</td>
                    <td className="px-4 py-3 text-center">
                      <MarginBadge status={margemStatus} showLabel={false} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => onNavigate('dish', dish.id)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title={t('dashboard.editDish')}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => duplicate(dish)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title={t('dashboard.duplicateDish')}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(dish)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title={t('dashboard.deleteDish')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {calculated.map(({ dish, custoTotalPorcao, precoVendaSugerido, cmvPct, margemStatus }) => (
              <div key={dish.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{dish.nome[lang] || dish.nome.pt}</h3>
                    {dish.categoria && <span className="text-xs text-gray-400">{dish.categoria}</span>}
                  </div>
                  <MarginBadge status={margemStatus} showLabel={false} />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">{t('dashboard.costPerPortion')}</div>
                    <div className="font-mono text-sm font-medium">{formatCurrency(custoTotalPorcao)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">{t('dashboard.salePrice')}</div>
                    <div className="font-mono text-sm font-semibold text-gray-900">{formatCurrency(precoVendaSugerido)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">{t('dashboard.cmv')}</div>
                    <div className="font-mono text-sm">{formatPct(cmvPct)}</div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => onNavigate('dish', dish.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100"
                  >
                    <Edit2 size={13} /> {t('dashboard.editDish')}
                  </button>
                  <button
                    onClick={() => duplicate(dish)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                    title={t('dashboard.duplicateDish')}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(dish)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
                    title={t('dashboard.deleteDish')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={t('dashboard.confirmDelete')}
          onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
