export type Lang = 'pt' | 'en' | 'es';
export type LocalizedString = { pt: string; en: string; es: string };

export type UnitPurchase = 'kg' | 'g' | 'lb' | 'oz' | 'L' | 'ml' | 'gal' | 'cup' | 'floz' | 'un' | 'pacote';

// Unidade do conteúdo de um pacote (peso, volume ou contagem).
export type PackageContentUnit = 'un' | 'g' | 'kg' | 'lb' | 'oz' | 'ml' | 'L';

export interface Ingredient {
  id: string;
  nome: LocalizedString;
  fornecedor?: string;
  unidadeCompra: UnitPurchase;
  precoCompra: number;
  // Quando unidadeCompra === 'pacote': o pacote contém `unidadesPorPacote`
  // de `pacoteConteudoUnidade` (ex: 10 lb, 12 un, 2 L). Default de unidade = 'un'.
  unidadesPorPacote?: number;
  pacoteConteudoUnidade?: PackageContentUnit;
  fatorCorrecao: number; // 1.0 = no loss, 1.15 = 15% loss
  precoAtualizadoEm?: number; // timestamp da última atualização de preço
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
  custoMaoObra: number;          // custo de mão de obra calculado (opcional)
  valorHoraMaoObra?: number;     // valor pago por hora ao cozinheiro
  tempoPreparoMin?: number;      // tempo de preparo em minutos (para o custo de mão de obra)
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
  markupPct: number;   // margem sobre o custo: (preço - custo) / custo × 100
  lucroPorcao: number;
  margemStatus: 'green' | 'yellow' | 'red';
  custoIncompleto: boolean;  // insumo ausente, sem preço ou quantidade zerada
  foodCostDisponivel: boolean; // custo completo e preço > 0
}

export type AppView = 'home' | 'dashboard' | 'ingredients' | 'shopping' | 'dish' | 'simulator' | 'converter' | 'export' | 'finance' | 'sheet';

// ---------- Modo consultor: restaurantes e financeiro ----------

export type CostType = 'fixed' | 'variable';

export interface BudgetItem {
  id: string;
  categoria: string;
  descricao: string;
  tipo: CostType;
  valor: number;
}

export type DeliveryPlatform = 'doordash' | 'ubereats' | 'grubhub';

export interface FinanceEntry {
  id: string;
  categoria: string;
  descricao: string;
  tipo: CostType;
  valor: number | null;          // null = ainda não lançado (não soma)
  plataforma?: DeliveryPlatform; // lançamentos de comissão/taxa de delivery
}

export interface FinanceMonth {
  restaurantId: string;
  period: string;                // 'YYYY-MM'
  status: 'open' | 'closed';
  estimateSnapshot: BudgetItem[] | null;
  entries: FinanceEntry[];
}

export interface Restaurant {
  id: string;
  name: string;
  currency: import('../lib/currency').Currency;
  logo?: string | null;          // data URL
  budget: BudgetItem[];
  createdAt: string;
  role: RestaurantRole;          // papel do usuário logado neste restaurante
}

export type RestaurantRole = 'owner' | 'viewer' | 'finance';
export type MemberRole = Exclude<RestaurantRole, 'owner'>;

export interface RestaurantMember {
  restaurantId: string;
  email: string;
  role: MemberRole;
  createdAt: string;
}
