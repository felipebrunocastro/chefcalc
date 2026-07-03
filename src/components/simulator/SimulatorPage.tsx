import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator } from 'lucide-react';
import { useDishes } from '../../hooks/useDishes';
import { useIngredients } from '../../hooks/useIngredients';
import { calcDish, simulateByPrice, simulateByMargin, formatCurrency, formatPct } from '../../utils/calculations';
import { MarginBadge } from '../ui/MarginBadge';
import type { Lang } from '../../types';

export function SimulatorPage() {
  const { t, i18n } = useTranslation();
  const { dishes } = useDishes();
  const { ingredients } = useIngredients();
  const [selectedDishId, setSelectedDishId] = useState('');
  const [chargePrice, setChargePrice] = useState('');
  const [wantMargin, setWantMargin] = useState('');
  const lang = i18n.language as Lang;

  const dish = useMemo(() => dishes.find(d => d.id === selectedDishId), [dishes, selectedDishId]);
  const calculated = useMemo(() => dish ? calcDish(dish, ingredients) : null, [dish, ingredients]);

  const marginFromPrice = chargePrice && calculated
    ? simulateByPrice(calculated.custoTotalPorcao, parseFloat(chargePrice))
    : null;

  const priceFromMargin = wantMargin && calculated
    ? simulateByMargin(calculated.custoTotalPorcao, parseFloat(wantMargin))
    : null;

  const getMarginStatus = (m: number): 'green' | 'yellow' | 'red' => {
    if (!dish) return 'green';
    const target = dish.margemLucroPct;
    if (m >= target * 0.9) return 'green';
    if (m >= target * 0.6) return 'yellow';
    return 'red';
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Calculator size={24} className="text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900">{t('simulator.title')}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-2">{t('simulator.selectDish')}</label>
        <select
          value={selectedDishId}
          onChange={e => { setSelectedDishId(e.target.value); setChargePrice(''); setWantMargin(''); }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">{t('simulator.selectPlaceholder')}</option>
          {dishes.map(d => (
            <option key={d.id} value={d.id}>{d.nome[lang] || d.nome.pt}</option>
          ))}
        </select>
      </div>

      {!calculated && (
        <div className="text-center py-12 text-gray-400">
          <Calculator size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t('simulator.noDish')}</p>
        </div>
      )}

      {calculated && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="text-xs text-amber-600 font-medium mb-1">{t('simulator.costPortion')}</div>
            <div className="text-2xl font-mono font-bold text-amber-700">
              {formatCurrency(calculated.custoTotalPorcao)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-medium text-gray-700 mb-3">{t('simulator.chargingLabel')}...</p>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-500">{t('common.currency')}</span>
                <input
                  type="number" min="0" step="0.01"
                  value={chargePrice}
                  onChange={e => setChargePrice(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-right font-mono"
                  placeholder="0.00"
                />
              </div>
              {marginFromPrice !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t('simulator.resultMargin')}</span>
                    <MarginBadge status={getMarginStatus(marginFromPrice)} value={marginFromPrice} showLabel={false} />
                  </div>
                  <div className="text-2xl font-mono font-bold text-gray-900 text-right">
                    {formatPct(marginFromPrice)}
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    Lucro: {formatCurrency(parseFloat(chargePrice) - calculated.custoTotalPorcao)}/porção
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-medium text-gray-700 mb-3">{t('simulator.wantMarginLabel')}...</p>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number" min="0" max="99" step="1"
                  value={wantMargin}
                  onChange={e => setWantMargin(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-right font-mono"
                  placeholder="30"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              {priceFromMargin !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t('simulator.resultPrice')}</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-amber-700 text-right">
                    {formatCurrency(priceFromMargin)}
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    Lucro: {formatCurrency(priceFromMargin - calculated.custoTotalPorcao)}/porção
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
