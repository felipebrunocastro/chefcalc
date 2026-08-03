import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Search, Check, RefreshCw } from 'lucide-react';
import { useIngredients } from '../../hooks/useIngredients';
import { useDishes } from '../../hooks/useDishes';
import { formatCurrency, unitCostOf } from '../../utils/calculations';
import type { Ingredient, Lang } from '../../types';

// Lista de compras + atualização rápida de preços. Ao salvar um preço novo,
// os pratos que usam o insumo recalculam o custo automaticamente.
export function ShoppingListPage() {
  const { t, i18n } = useTranslation();
  const { ingredients, save } = useIngredients();
  const { dishes } = useDishes();
  const lang = i18n.language as Lang;

  const [search, setSearch] = useState('');
  // preços em edição (string) por id, e feedback de salvo
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ingredients.filter(i =>
      (i.nome[lang] || i.nome.pt).toLowerCase().includes(q) ||
      (i.fornecedor || '').toLowerCase().includes(q)
    );
  }, [ingredients, search, lang]);

  // Quantos pratos usam cada insumo (para mostrar impacto da mudança de preço).
  const usageCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dishes) {
      for (const item of d.itens) {
        if (item.ingredienteId) map[item.ingredienteId] = (map[item.ingredienteId] || 0) + 1;
      }
    }
    return map;
  }, [dishes]);

  const priceOf = (ing: Ingredient) => (edits[ing.id] ?? String(ing.precoCompra));

  const commitPrice = async (ing: Ingredient) => {
    const raw = edits[ing.id];
    if (raw === undefined) return;
    const novo = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(novo) || novo === ing.precoCompra) return;
    await save({ ...ing, precoCompra: novo, precoAtualizadoEm: Date.now() });
    setSavedId(ing.id);
    setTimeout(() => setSavedId(s => (s === ing.id ? null : s)), 1500);
  };

  const estimatedTotal = useMemo(() => {
    let total = 0;
    for (const ing of ingredients) {
      const q = parseFloat((qty[ing.id] || '').replace(',', '.'));
      if (!Number.isNaN(q) && q > 0) total += q * ing.precoCompra;
    }
    return total;
  }, [ingredients, qty]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <ShoppingCart size={24} className="text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900">{t('shopping.title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('shopping.subtitle')}</p>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('ingredients.search')}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">{t('ingredients.noIngredients')}</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('ingredients.name')}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">{t('shopping.usedIn')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('shopping.price')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('ingredients.unitCost')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('shopping.buyQty')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => {
                  const uc = unitCostOf(ing);
                  return (
                    <tr key={ing.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{ing.nome[lang] || ing.nome.pt}</div>
                        {ing.fornecedor && <div className="text-xs text-gray-400">{ing.fornecedor}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {usageCount[ing.id]
                          ? <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{usageCount[ing.id]}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number" min="0" step="0.01"
                            value={priceOf(ing)}
                            onChange={e => setEdits(p => ({ ...p, [ing.id]: e.target.value }))}
                            onBlur={() => commitPrice(ing)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            className="w-24 px-2 py-1 border border-gray-200 rounded-md text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          {savedId === ing.id && <Check size={14} className="text-emerald-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600">{formatCurrency(uc.value)}{uc.label}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number" min="0" step="1"
                          value={qty[ing.id] || ''}
                          onChange={e => setQty(p => ({ ...p, [ing.id]: e.target.value }))}
                          placeholder="0"
                          className="w-20 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {filtered.map(ing => {
              const uc = unitCostOf(ing);
              return (
                <div key={ing.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{ing.nome[lang] || ing.nome.pt}</h3>
                      <div className="text-xs text-gray-400">
                        {formatCurrency(uc.value)}{uc.label}
                        {usageCount[ing.id] ? ` · ${usageCount[ing.id]} ${t('shopping.dishes')}` : ''}
                      </div>
                    </div>
                    {savedId === ing.id && <Check size={16} className="text-emerald-500" />}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">{t('shopping.price')}</div>
                      <input
                        type="number" min="0" step="0.01"
                        value={priceOf(ing)}
                        onChange={e => setEdits(p => ({ ...p, [ing.id]: e.target.value }))}
                        onBlur={() => commitPrice(ing)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                    <div className="w-24">
                      <div className="text-xs text-gray-400 mb-1">{t('shopping.buyQty')}</div>
                      <input
                        type="number" min="0" step="1"
                        value={qty[ing.id] || ''}
                        onChange={e => setQty(p => ({ ...p, [ing.id]: e.target.value }))}
                        placeholder="0"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {estimatedTotal > 0 && (
            <div className="mt-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-amber-700">{t('shopping.estimatedTotal')}</span>
              <span className="font-mono font-bold text-amber-700 text-lg">{formatCurrency(estimatedTotal)}</span>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4 flex items-center gap-1.5">
            <RefreshCw size={12} /> {t('shopping.autoUpdate')}
          </p>
        </>
      )}
    </div>
  );
}
