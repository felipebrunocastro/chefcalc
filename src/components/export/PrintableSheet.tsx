import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { calcDish, calcItemCost, laborCost, formatCurrency } from '../../utils/calculations';
import type { Dish, Ingredient, Lang, Restaurant } from '../../types';

export type PrintMode = 'managerial' | 'kitchen';

// Uma ficha técnica por página. O cabeçalho sempre traz a marca do restaurante
// dono da ficha (logo com proporção preservada; sem logo, o nome).
export function PrintableSheet({ dish, ingredients, restaurant, mode, lang, t }: {
  dish: Dish; ingredients: Ingredient[]; restaurant: Restaurant; mode: PrintMode; lang: Lang; t: TFunction;
}) {
  const ingMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);
  const calc = useMemo(() => calcDish(dish, ingredients), [dish, ingredients]);
  const name = dish.nome[lang] || dish.nome.pt;
  const managerial = mode === 'managerial';
  const labor = laborCost(dish);
  const totalBatch = calc.custoInsumos + labor;

  return (
    <article className="print-sheet bg-white text-slate-900 text-[12px] leading-snug">
      <header className="flex items-center gap-4 border-b-2 border-navy-900 pb-3 mb-4">
        {restaurant.logo ? (
          <img src={restaurant.logo} alt={restaurant.name} className="h-16 max-w-[2in] w-auto object-contain" />
        ) : (
          <span className="text-xl font-bold text-navy-900">{restaurant.name}</span>
        )}
        <div className="ml-auto text-right">
          {restaurant.logo && <div className="text-xs font-semibold text-slate-600">{restaurant.name}</div>}
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{managerial ? t('print.managerial') : t('print.kitchen')}</div>
        </div>
      </header>

      <h1 className="text-2xl font-bold text-navy-900">{name}</h1>
      <p className="text-slate-600 mb-4">
        {dish.categoria && <>{t('print.category')}: {dish.categoria} · </>}
        {t('print.yield')}: {dish.rendimentoPorcoes} {t('print.portions')}
        {dish.tempoPreparoMin ? <> · {dish.tempoPreparoMin} min</> : null}
      </p>

      <table className="w-full border-collapse mb-5">
        <thead>
          <tr className="bg-blue-50 border-y border-blue-200">
            <th className="text-left p-1.5">{t('print.ingredient')}</th>
            <th className="text-right p-1.5 w-24">{t('print.qty')}</th>
            <th className="text-center p-1.5 w-16">{t('print.unit')}</th>
            {managerial && <th className="text-right p-1.5 w-24">{t('print.cost')}</th>}
          </tr>
        </thead>
        <tbody>
          {dish.itens.map((item, i) => {
            const ing = ingMap.get(item.ingredienteId);
            return (
              <tr key={i} className="border-b border-slate-200">
                <td className="p-1.5">{ing ? (ing.nome[lang] || ing.nome.pt) : <i className="text-slate-400">{t('print.missingIngredient')}</i>}</td>
                <td className="p-1.5 text-right font-mono">{item.quantidadeUsada}</td>
                <td className="p-1.5 text-center">{item.unidade}</td>
                {managerial && <td className="p-1.5 text-right font-mono">{ing ? formatCurrency(calcItemCost(ing, item.quantidadeUsada, item.unidade)) : '—'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      {dish.etapas.length > 0 && (
        <section className="mb-5">
          <h2 className="font-bold uppercase text-[11px] tracking-wider text-navy-900 border-b border-slate-300 pb-1 mb-2">{t('print.steps')}</h2>
          <ol className="space-y-2">
            {dish.etapas.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-navy-900 text-white text-[10px] font-bold flex items-center justify-center">{step.ordem || i + 1}</span>
                <div>
                  <p>{step.descricao[lang] || step.descricao.pt}</p>
                  <p className="text-[10px] text-slate-500 flex gap-3">
                    {step.tempoMinutos > 0 && <span>{step.tempoMinutos} min</span>}
                    {step.temperatura && <span>{step.temperatura}</span>}
                    {step.equipamento && <span>{step.equipamento}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {managerial && (
        <section className="avoid-break">
          <h2 className="font-bold uppercase text-[11px] tracking-wider text-navy-900 border-b border-slate-300 pb-1 mb-2">{t('print.costs')}</h2>
          {calc.custoIncompleto && <p className="text-red-700 font-medium mb-2">⚠ {t('print.incomplete')}</p>}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 max-w-md">
            <dt className="text-slate-600">{t('print.ingredientCost')}</dt><dd className="text-right font-mono">{formatCurrency(calc.custoInsumos)}</dd>
            <dt className="text-slate-600">{t('print.labor')}</dt><dd className="text-right font-mono">{formatCurrency(labor)}</dd>
            <dt className="font-semibold">{t('print.totalCost')}</dt><dd className="text-right font-mono font-semibold">{formatCurrency(totalBatch)}</dd>
            <dt className="font-semibold">{t('print.costPerPortion')}</dt><dd className="text-right font-mono font-semibold">{formatCurrency(calc.custoTotalPorcao)}</dd>
            <dt className="font-bold text-navy-900">{t('print.price')}</dt><dd className="text-right font-mono font-bold text-navy-900">{formatCurrency(calc.precoVendaSugerido)}</dd>
            <dt className="text-slate-600">{t('print.foodCost')}</dt><dd className="text-right font-mono">{calc.foodCostDisponivel ? `${calc.cmvPct.toFixed(1)}%` : t('print.notAvailable')}</dd>
          </dl>
        </section>
      )}

      <footer className="mt-6 pt-2 border-t border-slate-200 text-[9px] text-slate-400 flex justify-between">
        <span>{restaurant.name}</span>
        <span>{t('print.generatedAt')} {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR')}</span>
      </footer>
    </article>
  );
}
