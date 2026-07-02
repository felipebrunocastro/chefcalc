export type Lang = 'pt' | 'en' | 'es';
export type LocalizedString = { pt: string; en: string; es: string };
export type UnitPurchase = 'kg' | 'g' | 'L' | 'ml' | 'un';

export interface Ingredient {
  id: string;
  nome: LocalizedString;
  fornecedor?: string;
  unidadeCompra: UnitPurchase;
  precoCompra: number;
  fatorCorrecao: number;
  createdAt: number;
}

export interface RecipeItem {
  ingredienteId: string;
  quantidadeUsada: number;
  unidade: string;
}

export interface PrepStep {
  ordem: number;
  descricao: LocalizedString;
  tempoMinutos: number;
  temperatura?: string;
  equipamento?: string;
}

export type PricingModel = 'markup' | 'foodcost';

export interface Dish {
  id: string;
  nome: LocalizedString;
  categoria: string;
  foto?: string;
  rendimentoPorcoes: number;
  itens: RecipeItem[];
  etapas: PrepStep[];
  custoMaoObra: number;
  despesasFixasPct: number;
  margemLucroPct: number;
  modeloPrecificacao: PricingModel;
  precoVendaManual?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CalculatedDish {
  dish: Dish;
  custoInsumos: number;
  custoTotalPorcao: number;
  precoVendaSugerido: number;
  cmvPct: number;
  lucroPorcao: number;
  margemStatus: 'green' | 'yellow' | 'red';
}

export type AppView = 'dashboard' | 'ingredients' | 'dish' | 'simulator' | 'export';
