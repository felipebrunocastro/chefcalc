import type { Dish, Ingredient, CalculatedDish } from '../types';

export { formatCurrency } from '../lib/currency';

// Fator para a unidade base (g para peso, ml para volume). Peso e volume
// coincidem na base porque o cálculo de custo compara unidades da mesma dimensão.
function unitToGrams(unit: string): number {
  switch (unit) {
    case 'kg': return 1000;
    case 'g': return 1;
    case 'mg': return 0.001;
    case 'lb': return 453.592;
    case 'oz': return 28.3495;
    case 'L': return 1000;
    case 'ml': return 1;
    case 'gal': return 3785.41;   // galão US
    case 'cup': return 236.588;   // cup US
    case 'floz': return 29.5735;  // onça fluida US
    default: return 1;
  }
}

const VOLUME_UNITS = new Set(['L', 'ml', 'gal', 'cup', 'floz']);

// Custo por unidade de uso do insumo + rótulo dessa unidade.
// Para 'pacote', o custo é por unidade individual (preço do pacote ÷ unidades no pacote).
export function unitCostOf(ing: Ingredient): { value: number; label: string } {
  if (ing.unidadeCompra === 'pacote') {
    const qty = ing.unidadesPorPacote && ing.unidadesPorPacote > 0 ? ing.unidadesPorPacote : 1;
    const cu = ing.pacoteConteudoUnidade || 'un';
    if (cu === 'un') {
      return { value: (ing.precoCompra / qty) * ing.fatorCorrecao, label: '/un' };
    }
    const packBase = qty * unitToGrams(cu); // conteúdo total em g ou ml
    const baseUnit = VOLUME_UNITS.has(cu) ? 'ml' : 'g';
    return { value: (ing.precoCompra / packBase) * ing.fatorCorrecao, label: '/' + baseUnit };
  }
  if (ing.unidadeCompra === 'un') {
    return { value: ing.precoCompra * ing.fatorCorrecao, label: '/un' };
  }
  const divisor = unitToGrams(ing.unidadeCompra);
  const baseUnit = VOLUME_UNITS.has(ing.unidadeCompra) ? 'ml' : 'g';
  return { value: (ing.precoCompra / divisor) * ing.fatorCorrecao, label: '/' + baseUnit };
}

// Dimensão do que se usa na receita para um insumo (peso, volume ou contagem).
export function usageDimension(ing: Ingredient): 'weight' | 'volume' | 'count' {
  const u = ing.unidadeCompra === 'pacote' ? (ing.pacoteConteudoUnidade || 'un') : ing.unidadeCompra;
  if (u === 'un') return 'count';
  return VOLUME_UNITS.has(u) ? 'volume' : 'weight';
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
  // Custo incompleto: ficha sem itens, insumo inexistente/de outro restaurante,
  // insumo sem preço ou quantidade não informada.
  let custoIncompleto = dish.itens.length === 0;
  for (const item of dish.itens) {
    const ing = ingredMap.get(item.ingredienteId);
    if (!ing || !(ing.precoCompra > 0) || !(item.quantidadeUsada > 0)) custoIncompleto = true;
    if (!ing) continue;
    custoInsumos += calcItemCost(ing, item.quantidadeUsada, item.unidade);
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
    // Food cost: margem é % do preço de venda. Limita a 99% (não existe 100%+).
    const margem = Math.min(Math.max(dish.margemLucroPct, 0), 99) / 100;
    precoVendaSugerido = baseComDespesas / (1 - margem);
  } else {
    // Markup: preço = custo + margem% do custo (previsível para qualquer %).
    precoVendaSugerido = baseComDespesas * (1 + dish.margemLucroPct / 100);
  }

  const cmvPct = precoVendaSugerido > 0 ? (custoTotalPorcao / precoVendaSugerido) * 100 : 0;
  const lucroPorcao = precoVendaSugerido - baseComDespesas;

  // Margem de lucro sobre o custo (markup): (preço - custo) / custo × 100.
  const markupPct = custoTotalPorcao > 0
    ? ((precoVendaSugerido - custoTotalPorcao) / custoTotalPorcao) * 100
    : 0;

  // Meta em markup (converte a margem-sobre-venda do modelo food cost).
  const targetMarkup = dish.modeloPrecificacao === 'foodcost'
    ? (dish.margemLucroPct < 100 ? (dish.margemLucroPct / (100 - dish.margemLucroPct)) * 100 : 900)
    : dish.margemLucroPct;

  let margemStatus: 'green' | 'yellow' | 'red';
  if (markupPct >= targetMarkup * 0.9) {
    margemStatus = 'green';
  } else if (markupPct >= targetMarkup * 0.6) {
    margemStatus = 'yellow';
  } else {
    margemStatus = 'red';
  }

  const foodCostDisponivel = !custoIncompleto && precoVendaSugerido > 0;

  return {
    dish, custoInsumos, custoTotalPorcao, precoVendaSugerido,
    cmvPct: foodCostDisponivel ? cmvPct : 0,
    markupPct, lucroPorcao, margemStatus, custoIncompleto, foodCostDisponivel,
  };
}

export function calcItemCost(
  ing: Ingredient,
  quantidadeUsada: number,
  unidade: string
): number {
  // Pacote: pode conter N unidades (contagem) ou um peso/volume total.
  if (ing.unidadeCompra === 'pacote') {
    const qty = ing.unidadesPorPacote && ing.unidadesPorPacote > 0 ? ing.unidadesPorPacote : 1;
    const cu = ing.pacoteConteudoUnidade || 'un';
    if (cu === 'un') {
      // custo por unidade × unidades usadas
      return (ing.precoCompra / qty) * ing.fatorCorrecao * quantidadeUsada;
    }
    // custo por base (g/ml) × quantidade usada convertida para base
    const packBase = qty * unitToGrams(cu);
    const costPerBase = ing.precoCompra / packBase;
    const usageBase = quantidadeUsada * unitToGrams(unidade);
    return costPerBase * usageBase * ing.fatorCorrecao;
  }
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
