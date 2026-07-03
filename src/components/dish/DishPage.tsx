import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDishes } from '../../hooks/useDishes';
import { useIngredients } from '../../hooks/useIngredients';
import { calcDish, calcItemCost, laborCost, formatCurrency, formatPct } from '../../utils/calculations';
import { MarginBadge } from '../ui/MarginBadge';
import type { AppView, Dish, RecipeItem, PrepStep, PricingModel, Lang } from '../../types';

const UNITS = ['g', 'kg', 'ml', 'L', 'un'];

interface Props {
  dishId?: string;
  onNavigate: (view: AppView, dishId?: string) => void;
}

function emptyDish(): Dish {
  return {
    id: uuidv4(),
    nome: { pt: '', en: '', es: '' },
    categoria: '',
    rendimentoPorcoes: 1,
    itens: [],
    etapas: [],
    custoMaoObra: 0,
    despesasFixasPct: 0,
    margemLucroPct: 30,
    modeloPrecificacao: 'foodcost',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function DishPage({ dishId, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const { dishes, save } = useDishes();
  const { ingredients } = useIngredients();
  const [dish, setDish] = useState<Dish>(emptyDish);
  const [activeTab, setActiveTab] = useState<'operational' | 'managerial'>('operational');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const lang = i18n.language as Lang;

  useEffect(() => {
    if (dishId) {
      const found = dishes.find(d => d.id === dishId);
      if (found) setDish(found);
    }
  }, [dishId, dishes]);

  const update = useCallback(<K extends keyof Dish>(key: K, value: Dish[K]) => {
    setDish(d => ({ ...d, [key]: value, updatedAt: Date.now() }));
  }, []);

  const calculated = useMemo(() => calcDish(dish, ingredients), [dish, ingredients]);
  const ingMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);

  const handleSave = async () => {
    await save({ ...dish, updatedAt: Date.now() });
    onNavigate('dashboard');
  };

  const addItem = () => {
    const newItem: RecipeItem = { ingredienteId: '', quantidadeUsada: 0, unidade: 'g' };
    update('itens', [...dish.itens, newItem]);
  };

  const updateItem = (idx: number, patch: Partial<RecipeItem>) => {
    const items = [...dish.itens];
    items[idx] = { ...items[idx], ...patch };
    update('itens', items);
  };

  const removeItem = (idx: number) => {
    update('itens', dish.itens.filter((_, i) => i !== idx));
  };

  const addStep = () => {
    const step: PrepStep = {
      ordem: dish.etapas.length + 1,
      descricao: { pt: '', en: '', es: '' },
      tempoMinutos: 0,
    };
    update('etapas', [...dish.etapas, step]);
    setExpandedStep(dish.etapas.length);
  };

  const updateStep = (idx: number, patch: Partial<PrepStep>) => {
    const steps = [...dish.etapas];
    steps[idx] = { ...steps[idx], ...patch };
    update('etapas', steps);
  };

  const removeStep = (idx: number) => {
    update('etapas', dish.etapas.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ordem: i + 1 })));
  };

  const totalTime = dish.etapas.reduce((acc, s) => acc + (s.tempoMinutos || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {dishId ? t('dish.edit') : t('dish.new')}
        </h1>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.name')} *</label>
          <input
            value={dish.nome.pt}
            onChange={e => update('nome', { pt: e.target.value, en: e.target.value, es: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder={t('dish.namePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.category')}</label>
            <input
              value={dish.categoria}
              onChange={e => update('categoria', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="ex: Entradas"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.portions')}</label>
            <input
              type="number" min="1" step="1"
              value={dish.rendimentoPorcoes}
              onChange={e => update('rendimentoPorcoes', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.marginPct')}</label>
            <input
              type="number" min="0" max="99" step="1"
              value={dish.margemLucroPct}
              onChange={e => update('margemLucroPct', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.pricingModel')}</label>
            <select
              value={dish.modeloPrecificacao}
              onChange={e => update('modeloPrecificacao', e.target.value as PricingModel)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="foodcost">{t('dish.foodcost')}</option>
              <option value="markup">{t('dish.markup')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.manualPrice')}</label>
            <input
              type="number" min="0" step="0.01"
              value={dish.precoVendaManual || ''}
              onChange={e => update('precoVendaManual', parseFloat(e.target.value) || undefined)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['operational', 'managerial'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`dish.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Ingredients section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('dish.recipe')}</h2>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            <Plus size={14} />
            {t('dish.addIngredient')}
          </button>
        </div>

        {dish.itens.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('dish.noItems')}</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 pr-2 font-medium text-gray-500 min-w-[180px]">{t('dish.ingredient')}</th>
                    <th className="text-right pb-2 px-2 font-medium text-gray-500 w-24">{t('dish.quantity')}</th>
                    <th className="text-center pb-2 px-2 font-medium text-gray-500 w-20">{t('dish.unit')}</th>
                    {activeTab === 'managerial' && (
                      <>
                        <th className="text-right pb-2 px-2 font-medium text-gray-500 w-28">{t('dish.unitCost')}</th>
                        <th className="text-right pb-2 px-2 font-medium text-gray-500 w-28">{t('dish.totalCost')}</th>
                      </>
                    )}
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {dish.itens.map((item, idx) => {
                    const ing = ingMap.get(item.ingredienteId);
                    const itemCost = ing ? calcItemCost(ing, item.quantidadeUsada, item.unidade) : 0;
                    return (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="py-2 pr-2">
                          <select
                            value={item.ingredienteId}
                            onChange={e => updateItem(idx, { ingredienteId: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                          >
                            <option value="">{t('dish.selectIngredient')}</option>
                            {ingredients.map(i => (
                              <option key={i.id} value={i.id}>{i.nome[lang] || i.nome.pt}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number" min="0" step="0.001"
                            value={item.quantidadeUsada}
                            onChange={e => updateItem(idx, { quantidadeUsada: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={item.unidade}
                            onChange={e => updateItem(idx, { unidade: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                          >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        {activeTab === 'managerial' && (
                          <>
                            <td className="py-2 px-2 text-right font-mono text-xs text-gray-500">
                              {ing ? formatCurrency(ing.precoCompra / (ing.unidadeCompra === 'kg' || ing.unidadeCompra === 'L' ? 1000 : 1)) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-sm font-medium text-gray-800">
                              {ing ? formatCurrency(itemCost) : '—'}
                            </td>
                          </>
                        )}
                        <td className="py-2">
                          <button onClick={() => removeItem(idx)} className="p-1 text-gray-300 hover:text-red-400 rounded">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {activeTab === 'managerial' && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td colSpan={4} className="pt-2 text-sm font-medium text-gray-600 text-right pr-2">{t('dish.ingredientsCost')}</td>
                      <td className="pt-2 text-right font-mono font-semibold text-gray-900">{formatCurrency(calculated.custoInsumos)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {dish.itens.map((item, idx) => {
                const ing = ingMap.get(item.ingredienteId);
                const itemCost = ing ? calcItemCost(ing, item.quantidadeUsada, item.unidade) : 0;
                return (
                  <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <select
                        value={item.ingredienteId}
                        onChange={e => updateItem(idx, { ingredienteId: e.target.value })}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white mr-2"
                      >
                        <option value="">{t('dish.selectIngredient')}</option>
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.nome[lang] || i.nome.pt}</option>
                        ))}
                      </select>
                      <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 bg-red-50 rounded-md">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number" min="0" step="0.001"
                        value={item.quantidadeUsada}
                        onChange={e => updateItem(idx, { quantidadeUsada: parseFloat(e.target.value) || 0 })}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                        placeholder="Qtd"
                      />
                      <select
                        value={item.unidade}
                        onChange={e => updateItem(idx, { unidade: e.target.value })}
                        className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      {activeTab === 'managerial' && ing && (
                        <span className="px-2 py-1.5 text-sm font-mono text-amber-700 bg-amber-50 rounded-md">
                          {formatCurrency(itemCost)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Prep steps */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('dish.steps')}</h2>
            {totalTime > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">Total: {totalTime} min</p>
            )}
          </div>
          <button
            onClick={addStep}
            className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            <Plus size={14} />
            {t('dish.addStep')}
          </button>
        </div>
        <div className="space-y-2">
          {dish.etapas.map((step, idx) => (
            <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
              >
                <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                <span className="text-xs font-bold text-amber-500 w-6">{step.ordem}</span>
                <span className="flex-1 text-sm text-gray-700 truncate">
                  {step.descricao[lang] || step.descricao.pt || '...'}
                </span>
                {step.tempoMinutos > 0 && (
                  <span className="text-xs text-gray-400">{step.tempoMinutos}min</span>
                )}
                <button onClick={e => { e.stopPropagation(); removeStep(idx); }} className="p-1 text-gray-300 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
                {expandedStep === idx ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
              {expandedStep === idx && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.stepDesc')}</label>
                    <textarea
                      rows={2}
                      value={step.descricao.pt}
                      onChange={e => updateStep(idx, { descricao: { pt: e.target.value, en: e.target.value, es: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.stepTime')}</label>
                    <input
                      type="number" min="0"
                      value={step.tempoMinutos}
                      onChange={e => updateStep(idx, { tempoMinutos: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.stepTemp')}</label>
                    <input
                      value={step.temperatura || ''}
                      onChange={e => updateStep(idx, { temperatura: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                      placeholder="ex: 180°C"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.stepEquip')}</label>
                    <input
                      value={step.equipamento || ''}
                      onChange={e => updateStep(idx, { equipamento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                      placeholder="ex: Forno combinado"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {dish.etapas.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">{t('dish.noItems')}</p>
          )}
        </div>
      </div>

      {/* Labor cost (managerial, optional) */}
      {activeTab === 'managerial' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('dish.laborTitle')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('dish.laborOptional')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.hourlyRate')}</label>
              <input
                type="number" min="0" step="0.01"
                value={dish.valorHoraMaoObra ?? ''}
                onChange={e => update('valorHoraMaoObra', parseFloat(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="ex: 25.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.prepTime')}</label>
              <input
                type="number" min="0" step="1"
                value={dish.tempoPreparoMin ?? ''}
                onChange={e => update('tempoPreparoMin', parseFloat(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="ex: 45"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.laborCostLabel')}</label>
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-mono font-medium text-gray-800">
                {formatCurrency(laborCost(dish))}
              </div>
            </div>
          </div>
          <div className="mt-3 max-w-[220px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('dish.fixedExpensesPct')}</label>
            <input
              type="number" min="0" max="100" step="1"
              value={dish.despesasFixasPct || ''}
              onChange={e => update('despesasFixasPct', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="ex: 15"
            />
            <p className="text-xs text-gray-400 mt-1">{t('dish.fixedExpensesHelp')}</p>
          </div>
        </div>
      )}

      {/* Cost summary (managerial) */}
      {activeTab === 'managerial' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('dish.summary')}</h2>
            <MarginBadge status={calculated.margemStatus} value={100 - calculated.cmvPct} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">{t('dish.ingredientsCost')}</div>
              <div className="font-mono font-semibold text-gray-900">{formatCurrency(calculated.custoInsumos)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">{t('dish.totalCostPortion')}</div>
              <div className="font-mono font-semibold text-gray-900">{formatCurrency(calculated.custoTotalPorcao)}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-xs text-amber-600 mb-1">{t('dish.suggestedPrice')}</div>
              <div className="font-mono font-bold text-amber-700 text-lg">{formatCurrency(calculated.precoVendaSugerido)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">{t('dish.cmv')}</div>
              <div className="font-mono font-semibold text-gray-900">{formatPct(calculated.cmvPct)}</div>
            </div>
          </div>
          <div className="mt-3 bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">{t('dish.profitPortion')}</div>
            <div className={`font-mono font-semibold ${calculated.lucroPorcao >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrency(calculated.lucroPorcao)}
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!dish.nome.pt}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
        >
          {t('dish.save')}
        </button>
        <button
          onClick={() => onNavigate('dashboard')}
          className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium text-sm hover:bg-gray-50"
        >
          {t('dish.back')}
        </button>
      </div>
    </div>
  );
}
