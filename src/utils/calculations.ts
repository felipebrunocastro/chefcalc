import type { Dish, Ingredient, CalculatedDish } from '../types';

export { formatCurrency } from '../lib/currency';

function unitToGrams(unit: string): number {
  switch (unit) {
    case 'kg': return 1000;
    case 'g': return 1;
    case 'L': return 1000;
    case 'ml': return 1;
    default: return 1;
  }
}

// Custo de mão de obra: derivado de valor/hora × tempo, ou valor fixo antigo
export function laborCost(dish: Dish): number {
  if (dish.valorHoraMaoObra && dish.tempoPreparoMin) {
    return dish.valorHoraMaoObra * (dish.tempoPreparoMin / 60);
  }
  return dish.custoMaoObra || 0;
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
    const costPerUsageUnit = costPerBase * usageUnitInBase;
    const costReal = costPerUsageUnit * ing.fatorCorrecao;
    const costInDish = costReal * item.quantidadeUsada;
    custoInsumos += costInDish;
  }

  const custoMaoObra = laborCost(dish);

  const porcoes = dish.rendimentoPorcoes || 1;
  const custoTotalPorcao = (custoInsumos + custoMaoObra) / porcoes;

  // Despesas fixas (aluguel, energia...) entram como acréscimo sobre o custo direto.
  const despesasPct = dish.despesasFixasPct || 0;
  const baseComDespesas = custoTotalPorcao * (1 + despesasPct / 100);

  let precoVendaSugerido: number;
  if (dish.precoVendaManual && dish.precoVendaManual > 0) {
    precoVendaSugerido = dish.precoVendaManual;
  } else if (dish.modeloPrecificacao === 'foodcost') {
    const margem = dish.margemLucroPct / 100;
    precoVendaSugerido = margem >= 1 ? baseComDespesas * 2 : baseComDespesas / (1 - margem);
  } else {
    precoVendaSugerido = baseComDespesas * (1 + dish.margemLucroPct / 100);
  }

  const cmvPct = precoVendaSugerido > 0 ? (custoTotalPorcao / precoVendaSugerido) * 100 : 0;
  const lucroPorcao = precoVendaSugerido - baseComDespesas;

  const targetMargin = dish.margemLucroPct;
  const actualMarginPct = precoVendaSugerido > 0
    ? (lucroPorcao / precoVendaSugerido) * 100
    : 0;

  let margemStatus: 'green' | 'yellow' | 'red';
  if (actualMarginPct >= targetMargin * 0.9) {
    margemStatus = 'green';
  } else if (actualMarginPct >= targetMargin * 0.6) {
    margemStatus = 'yellow';
  } else {
    margemStatus = 'red';
  }

  return { dish, custoInsumos, custoTotalPorcao, precoVendaSugerido, cmvPct, lucroPorcao, margemStatus };
}

export function calcItemCost(
  ing: Ingredient,
  quantidadeUsada: number,
  unidade: string
): number {
  const purchaseUnitInBase = unitToGrams(ing.unidadeCompra);
  const usageUnitInBase = unitToGrams(unidade);
  const costPerBase = ing.precoCompra / purchaseUnitInBase;
  const costPerUsageUnit = costPerBase * usageUnitInBase;
  return costPerUsageUnit * ing.fatorCorrecao * quantidadeUsada;
}

export function simulateByPrice(costPerPortion: number, price: number): number {
  if (price <= 0) return 0;
  return ((price - costPerPortion) / price) * 100;
}

export function simulateByMargin(costPerPortion: number, marginPct: number): number {
  const m = marginPct / 100;
  if (m >= 1) return costPerPortion * 2;
  return costPerPortion / (1 - m);
}

export function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}
