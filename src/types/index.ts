export type Lang = 'pt' | 'en' | 'es';
export type LocalizedString = { pt: string; en: string; es: string };

export type UnitPurchase = 'kg' | 'g' | 'lb' | 'oz' | 'L' | 'ml' | 'gal' | 'cup' | 'floz' | 'un' | 'pacote';

// Unidade do conteúdo de um pacote (peso, volume ou contagem).
export type PackageContentUnit = 'un' | 'g' | 'kg' | 'lb' | 'oz' | 'ml' | 'L';

export interface Ingredient {
  id: string;
  nome: LocalizedString;
  fornecedor?: string;
  grupo?: string; // ex.: "Carnes y Proteínas" (organiza a lista e a lista de compras)
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

export type AppView = 'home' | 'dashboard' | 'ingredients' | 'shopping' | 'dish' | 'simulator' | 'converter' | 'export' | 'finance' | 'sheet' | 'profile' | 'pos';

// ---------- Modo consultor: restaurantes e financeiro ----------

export type CostType = 'fixed' | 'variable' | 'mixed';
// Natureza do custo variável (usada no ponto de equilíbrio).
export type VariableKind = 'cogs' | 'packaging' | 'labor' | 'fees' | 'other';

export interface BudgetItem {
  id: string;
  categoria: string;
  descricao: string;
  tipo: CostType;
  valor: number;                 // valor mensal em dinheiro (ou % das vendas se unidade = 'pct')
  unidade?: 'money' | 'pct';     // só para variáveis
  parteFixa?: number;            // só para mistos: parte fixa do valor
  natureza?: VariableKind;       // variáveis e parte variável dos mistos
}

export type DeliveryPlatform = 'doordash' | 'ubereats' | 'grubhub';

export interface FinanceEntry {
  id: string;
  categoria: string;
  descricao: string;
  tipo: CostType;
  valor: number | null;          // null = ainda não lançado (não soma)
  plataforma?: DeliveryPlatform; // lançamentos de comissão/taxa de delivery
  parteFixa?: number;            // mistos
  natureza?: VariableKind;
}

// Vendas líquidas do mês por canal: após descontos/devoluções, sem sales tax nem gorjetas
// repassadas. Delivery: receita atribuível ao restaurante ANTES das comissões.
export interface MonthSales {
  channels?: Record<string, number | null>;
  deposits?: Record<string, number | null>; // depósito líquido da plataforma (só conciliação)
  inventoryStart?: number | null;           // estoque inicial (para CMV consumido)
  inventoryEnd?: number | null;             // estoque final
  // Camada importada (separada dos valores digitados): aplicada a partir de Integrações e importações.
  imported?: {
    channels: Record<string, number>;       // vendas líquidas por canal
    fees: Record<string, number>;           // comissões + promoções + outras taxas por canal
    payouts: Record<string, number>;        // repasses com data no mês
    appliedAt: string;
    recordCount: number;
  };
}

export interface FinanceMonth {
  restaurantId: string;
  period: string;                // 'YYYY-MM'
  status: 'open' | 'closed';
  estimateSnapshot: BudgetItem[] | null;
  entries: FinanceEntry[];
  sales?: MonthSales;
}

export interface Restaurant {
  id: string;
  name: string;
  currency: import('../lib/currency').Currency;
  logo?: string | null;          // data URL
  budget: BudgetItem[];
  createdAt: string;
  role: RestaurantRole;
  profile: RestaurantProfile;
  goals: GoalsSettings;          // papel do usuário logado neste restaurante
  memberUnit?: string | null;    // unidade autorizada (acesso restrito por unidade)
}

export type RestaurantRole = 'owner' | 'viewer' | 'finance' | 'operator';
export type MemberRole = Exclude<RestaurantRole, 'owner'>;

export interface RestaurantMember {
  restaurantId: string;
  email: string;
  role: MemberRole;
  createdAt: string;
}

// ---------- Perfil do restaurante ----------

export type EstablishmentType = 'restaurant' | 'snackbar' | 'cafe' | 'bakery' | 'confectionery' | 'foodtruck'
  | 'kiosk' | 'icecream' | 'bar' | 'catering' | 'ghostkitchen' | 'other';
export type ServiceMode = 'table' | 'counter' | 'buffet' | 'pickup' | 'delivery' | 'drivethru' | 'catering';
export type ServiceSegment = 'full' | 'limited' | 'other';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Shift { open: string; close: string }
export interface DayHours { closed: boolean; shifts: Shift[] }
export interface TruckLocation { id: string; name: string; address: string; days: Weekday[] }
export interface ExtraLink { id: string; label: string; url: string }

export interface DeliveryChannel {
  id: string;                    // 'doordash' | 'ubereats' | 'grubhub' | 'own' | uuid (personalizado)
  name: string;
  active: boolean;
  url: string;
  feePct: number | null;         // taxa estimada (%) para simulações
}

export interface RestaurantProfile {
  legalName?: string; unitName?: string; coverPhoto?: string | null;
  shortDescription?: string; description?: string;
  establishmentType?: EstablishmentType; establishmentTypeCustom?: string;
  cuisines?: string[]; primaryCuisine?: string;
  serviceModes?: ServiceMode[]; serviceSegment?: ServiceSegment;
  address?: string; address2?: string; city?: string; state?: string; zip?: string; country?: string; timezone?: string;
  hours?: Partial<Record<Weekday, DayHours>>;
  truckLocations?: TruckLocation[];
  businessPhone?: string; businessEmail?: string; whatsapp?: string;
  website?: string; menuUrl?: string; directOrdersUrl?: string; reservationsUrl?: string;
  instagram?: string; facebook?: string; tiktok?: string; otherLinks?: ExtraLink[];
  googleMapsUrl?: string; googleReviewUrl?: string;
  delivery?: DeliveryChannel[];
  openDaysPerMonth?: number | null;
  avgTicket?: number | null;
  ticketByChannel?: Record<string, number | null>;
  // Caixa e Vendas (configurado pelo dono)
  pos?: { taxPct?: number | null; maxDiscountPct?: number | null; units?: string[] };
}

// Dados privados (só o dono vê): ficam numa tabela separada no banco.
export interface RestaurantPrivate {
  ownerName?: string; managerName?: string; privatePhone?: string; privateEmail?: string; consultingNotes?: string;
}

// ---------- Metas de vendas / ponto de equilíbrio ----------

export interface ChannelMix { share: number | null; feePct: number | null }

export interface GoalsSettings {
  basis?: 'budget' | 'month';
  basisPeriod?: string;
  includeOwnerPay?: boolean;
  ownerPay?: number | null;
  cogsMode?: 'consumed' | 'purchases';
  referenceRevenue?: number | null;
  useMix?: boolean;
  mix?: Record<string, ChannelMix>;
  scenarios?: number[];
  customPct?: number | null;
  customProfit?: number | null;
  dashboardScenario?: number;
}
