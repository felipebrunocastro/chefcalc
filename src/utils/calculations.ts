import type { Dish, Ingredient, CalculatedDish } from '../types';

function unitToGrams(unit: string): number {
  switch (unit) {
    case 'kg': return 1000;
    case 'g': return 1;
    case 'L': return 1000;
    case 'ml': return 1;
    default: return 1;
  }
}

export function calcDish(dish: Dish, ingredients: Ingredient[]): CalculatedDish {
  const ingredMap = new Map(ingredients.map(i => [i.id, i]));
  let custoInsumos = 0;
  for (const item of dish.itens) {
    const ing = ingredMap.get(item.ingredienteId);
    if (!ing) continue;
    const purchaseUnitInBase = unitToGrams(ing.unidadeCompra);
    const usageUnitInBase = unitToGrams(item.unidade);
    const costPerBase = ing.precoCompra / purchaseUnitInBase;
    const costReal = costPerBase * usageUnitInBase * ing.fatorCorrecao;
    custoInsumos += costReal * item.quantidadeUsada;
  }
  const porcoes = dish.rendimentoPorcoes || 1;
  const custoTotalPorcao = (custoInsumos + (dish.custoMaoObra || 0)) / porcoes;
  let precoVendaSugerido: number;
  if (dish.precoVendaManual && dish.precoVendaManual > 0) {
    precoVendaSugerido = dish.precoVendaManual;
  } else if (dish.modeloPrecificacao === 'foodcost') {
    const m = dish.margemLucroPct / 100;
    precoVendaSugerido = m >= 1 ? custoTotalPorcao * 2 : custoTotalPorcao / (1 - m);
  } else {
    precoVendaSugerido = custoTotalPorcao * (1 + dish.margemLucroPct / 100);
  }
  const cmvPct = precoVendaSugerido > 0 ? (custoTotalPorcao / precoVendaSugerido) * 100 : 0;
  const lucroPorcao = precoVendaSugerido - custoTotalPorcao;
  const actualMarginPct = precoVendaSugerido > 0 ? ((precoVendaSugerido - custoTotalPorcao) / precoVendaSugerido) * 100 : 0;
  let margemStatus: 'green' | 'yellow' | 'red';
  if (actualMarginPct >= dish.margemLucroPct * 0.9) margemStatus = 'green';
  else if (actualMarginPct >= dish.margemLucroPct * 0.6) margemStatus = 'yellow';
  else margemStatus = 'red';
  return { dish, custoInsumos, custoTotalPorcao, precoVendaSugerido, cmvPct, lucroPorcao, margemStatus };
}

export function calcItemCost(ing: Ingredient, quantidadeUsada: number, unidade: string): number {
  const purchaseUnitInBase = unitToGrams(ing.unidadeCompra);
  const usageUnitInBase = unitToGrams(unidade);
  return (ing.precoCompra / purchaseUnitInBase) * usageUnitInBase * ing.fatorCorrecao * quantidadeUsada;
}

export function simulateByPrice(costPerPortion: number, price: number): number {
  if (price <= 0) return 0;
  return ((price - costPerPortion) / price) * 100;
}

export function simulateByMargin(costPerPortion: number, marginPct: number): number {
  const m = marginPct / 100;
  return m >= 1 ? costPerPortion * 2 : costPerPortion / (1 - m);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}
