import { supabase } from '../lib/supabase';
import type { Ingredient, Dish, Restaurant, FinanceMonth, BudgetItem, MemberRole, RestaurantMember, RestaurantRole } from '../types';
import type { Currency } from '../lib/currency';

// Todas as linhas são protegidas por RLS no Supabase: o usuário só alcança
// restaurantes próprios, e insumos/fichas/finanças só dos seus restaurantes.
// Os filtros por restaurant_id abaixo definem o escopo da tela; a permissão
// é validada no banco (ver supabase/migrations/002_restaurants.sql).

async function currentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

// ---------- Restaurantes ----------

interface RestaurantRow {
  id: string; user_id?: string; name: string; currency: string; logo: string | null;
  budget: BudgetItem[] | null; created_at: string;
}

const toRestaurant = (r: RestaurantRow, role: RestaurantRole = 'owner'): Restaurant => ({
  role,
  id: r.id,
  name: r.name,
  currency: (r.currency || 'BRL') as Currency,
  logo: r.logo,
  budget: Array.isArray(r.budget) ? r.budget : [],
  createdAt: r.created_at,
});

// Restaurantes próprios + os compartilhados comigo (o RLS devolve os dois).
export async function getRestaurants(): Promise<Restaurant[]> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  const email = (u.user?.email ?? '').toLowerCase();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, user_id, name, currency, logo, budget, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  // Papéis nos restaurantes compartilhados. Tolerante: antes da migração 003 a tabela não existe.
  const roles = new Map<string, MemberRole>();
  if (email) {
    const { data: m } = await supabase.from('restaurant_members').select('restaurant_id, role').eq('email', email);
    for (const r of m ?? []) roles.set((r as { restaurant_id: string }).restaurant_id, (r as { role: MemberRole }).role);
  }
  return (data ?? []).map(r => {
    const row = r as RestaurantRow;
    return toRestaurant(row, row.user_id === uid ? 'owner' : roles.get(row.id) ?? 'viewer');
  });
}

// ---------- Compartilhamento ----------

export async function getMembers(restaurantId: string): Promise<RestaurantMember[]> {
  const { data, error } = await supabase
    .from('restaurant_members')
    .select('restaurant_id, email, role, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => ({ restaurantId: r.restaurant_id, email: r.email, role: r.role, createdAt: r.created_at }));
}

export async function saveMember(restaurantId: string, email: string, role: MemberRole): Promise<void> {
  const { error } = await supabase
    .from('restaurant_members')
    .upsert({ restaurant_id: restaurantId, email: email.trim().toLowerCase(), role });
  if (error) throw error;
}

export async function removeMember(restaurantId: string, email: string): Promise<void> {
  const { error } = await supabase.from('restaurant_members').delete().eq('restaurant_id', restaurantId).eq('email', email);
  if (error) throw error;
}

export async function createRestaurant(input: { name: string; currency: Currency; logo?: string | null }): Promise<Restaurant> {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from('restaurants')
    .insert({ user_id, name: input.name.trim(), currency: input.currency, logo: input.logo ?? null })
    .select('id, name, currency, logo, budget, created_at')
    .single();
  if (error) throw error;
  return toRestaurant(data as RestaurantRow);
}

export async function updateRestaurant(id: string, patch: Partial<Pick<Restaurant, 'name' | 'currency' | 'logo' | 'budget'>>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.currency !== undefined) row.currency = patch.currency; // só formatação: valores não são convertidos
  if (patch.logo !== undefined) row.logo = patch.logo;
  if (patch.budget !== undefined) row.budget = patch.budget;
  const { error } = await supabase.from('restaurants').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteRestaurant(id: string): Promise<void> {
  const { error } = await supabase.from('restaurants').delete().eq('id', id);
  if (error) throw error;
}

// Contagem de fichas por restaurante (para os cards do painel).
export async function getDishCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('dishes').select('restaurant_id');
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const id = (r as { restaurant_id: string }).restaurant_id;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

// ---------- Insumos ----------

export async function getIngredients(restaurantId: string): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('data')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => r.data as Ingredient);
}

export async function saveIngredient(restaurantId: string, ing: Ingredient): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await supabase
    .from('ingredients')
    .upsert({ id: ing.id, user_id, restaurant_id: restaurantId, data: ing });
  if (error) throw error;
}

export async function deleteIngredient(restaurantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id).eq('restaurant_id', restaurantId);
  if (error) throw error;
}

// ---------- Fichas técnicas ----------

export async function getDishes(restaurantId: string): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('data')
    .eq('restaurant_id', restaurantId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => r.data as Dish);
}

export async function saveDish(restaurantId: string, dish: Dish): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await supabase
    .from('dishes')
    .upsert({ id: dish.id, user_id, restaurant_id: restaurantId, data: dish, updated_at: new Date(dish.updatedAt).toISOString() });
  if (error) throw error;
}

export async function deleteDish(restaurantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', id).eq('restaurant_id', restaurantId);
  if (error) throw error;
}

// ---------- Financeiro ----------

interface FinanceRow {
  restaurant_id: string; period: string; status: 'open' | 'closed';
  estimate_snapshot: BudgetItem[] | null; entries: FinanceMonth['entries'] | null;
}

const toMonth = (r: FinanceRow): FinanceMonth => ({
  restaurantId: r.restaurant_id,
  period: r.period,
  status: r.status,
  estimateSnapshot: r.estimate_snapshot,
  entries: Array.isArray(r.entries) ? r.entries : [],
});

export async function getFinanceMonths(restaurantId: string): Promise<FinanceMonth[]> {
  const { data, error } = await supabase
    .from('finance_months')
    .select('restaurant_id, period, status, estimate_snapshot, entries')
    .eq('restaurant_id', restaurantId)
    .order('period', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => toMonth(r as FinanceRow));
}

export async function saveFinanceMonth(m: FinanceMonth): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await supabase.from('finance_months').upsert({
    restaurant_id: m.restaurantId,
    period: m.period,
    user_id,
    status: m.status,
    estimate_snapshot: m.estimateSnapshot,
    entries: m.entries,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
