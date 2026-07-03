import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, Package } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useIngredients } from '../../hooks/useIngredients';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { formatCurrency } from '../../utils/calculations';
import type { Ingredient, UnitPurchase, Lang } from '../../types';

const UNITS: UnitPurchase[] = ['kg', 'g', 'L', 'ml', 'un'];

interface FormState {
  nome: string;
  fornecedor: string;
  unidadeCompra: UnitPurchase;
  precoCompra: number;
  fatorCorrecao: number;
}

const EMPTY: FormState = {
  nome: '',
  fornecedor: '',
  unidadeCompra: 'kg',
  precoCompra: 0,
  fatorCorrecao: 1,
};

export function IngredientsPage() {
  const { t, i18n } = useTranslation();
  const { ingredients, save, remove } = useIngredients();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const lang = i18n.language as Lang;

  const filtered = useMemo(() => {
    return ingredients.filter(i => {
      const name = i.nome[lang] || i.nome.pt;
      return name.toLowerCase().includes(search.toLowerCase()) ||
        (i.fornecedor || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [ingredients, search, lang]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    setForm({
      nome: ing.nome[lang] || ing.nome.pt,
      fornecedor: ing.fornecedor || '',
      unidadeCompra: ing.unidadeCompra,
      precoCompra: ing.precoCompra,
      fatorCorrecao: ing.fatorCorrecao,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    const now = Date.now();
    const ing: Ingredient = {
      id: editing?.id || uuidv4(),
      createdAt: editing?.createdAt || now,
      nome: { pt: form.nome, en: form.nome, es: form.nome },
      fornecedor: form.fornecedor,
      unidadeCompra: form.unidadeCompra,
      precoCompra: form.precoCompra,
      fatorCorrecao: form.fatorCorrecao,
    };
    await save(ing);
    closeForm();
  };

  const unitCost = (ing: Ingredient): number => {
    const divisor = ing.unidadeCompra === 'kg' || ing.unidadeCompra === 'L' ? 1000 : 1;
    return (ing.precoCompra / divisor) * ing.fatorCorrecao;
  };

  const unitCostLabel = (ing: Ingredient): string => {
    const baseUnit = ing.unidadeCompra === 'kg' ? 'g' : ing.unidadeCompra === 'L' ? 'ml' : ing.unidadeCompra;
    return `/${baseUnit}`;
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('ingredients.title')}</h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <Plus size={16} />
          {t('ingredients.add')}
        </button>
      </div>

      {/* Form */}
      {formOpen && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-amber-700 mb-4 uppercase tracking-wide">
            {editing ? t('ingredients.edit') : t('ingredients.add')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('ingredients.name')}</label>
              <input
                autoFocus
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder={t('ingredients.namePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('ingredients.supplier')}</label>
              <input
                value={form.fornecedor}
                onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('ingredients.purchaseUnit')}</label>
              <select
                value={form.unidadeCompra}
                onChange={e => setForm(f => ({ ...f, unidadeCompra: e.target.value as UnitPurchase }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('ingredients.purchasePrice')}</label>
              <input
                type="number" min="0" step="0.01"
                value={form.precoCompra}
                onChange={e => setForm(f => ({ ...f, precoCompra: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('ingredients.correctionFactor')}</label>
              <input
                type="number" min="1" step="0.01"
                value={form.fatorCorrecao}
                onChange={e => setForm(f => ({ ...f, fatorCorrecao: parseFloat(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">{t('ingredients.correctionHelp')}</p>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">{t('ingredients.save')}</button>
            <button onClick={closeForm} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">{t('ingredients.cancel')}</button>
          </div>
        </div>
      )}

      {/* Search */}
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
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Package size={40} className="mb-3 opacity-40" />
          <p>{t('ingredients.noIngredients')}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('ingredients.name')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('ingredients.supplier')}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">{t('ingredients.purchaseUnit')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('ingredients.purchasePrice')}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">{t('ingredients.correctionFactor')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">{t('ingredients.unitCost')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => (
                  <tr key={ing.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{ing.nome[lang] || ing.nome.pt}</td>
                    <td className="px-4 py-3 text-gray-500">{ing.fornecedor || '—'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{ing.unidadeCompra}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(ing.precoCompra)}/{ing.unidadeCompra}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{ing.fatorCorrecao.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(unitCost(ing))}{unitCostLabel(ing)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => openEdit(ing)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteTarget(ing)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(ing => (
              <div key={ing.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{ing.nome[lang] || ing.nome.pt}</h3>
                    {ing.fornecedor && <p className="text-xs text-gray-400">{ing.fornecedor}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(ing)} className="p-1.5 text-amber-500 bg-amber-50 rounded-md"><Edit2 size={13} /></button>
                    <button onClick={() => setDeleteTarget(ing)} className="p-1.5 text-red-500 bg-red-50 rounded-md"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-gray-400">{t('ingredients.purchaseUnit')}</div>
                    <div className="font-medium">{ing.unidadeCompra}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">{t('ingredients.purchasePrice')}</div>
                    <div className="font-mono">{formatCurrency(ing.precoCompra)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">{t('ingredients.unitCost')}</div>
                    <div className="font-mono">{formatCurrency(unitCost(ing))}{unitCostLabel(ing)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={t('ingredients.confirmDelete')}
          onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
