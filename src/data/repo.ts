import { supabase } from '../lib/supabase';
import type { Ingredient, Dish } from '../types';

// Rows are scoped to the logged-in user via Supabase RLS (user_id).
// Nested structures (nome, itens, etapas) are stored as JSONB.

export async function getIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('data')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => r.data as Ingredient);
}

export async function saveIngredient(ing: Ingredient): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  const { error } = await supabase
    .from('ingredients')
    .upsert({ id: ing.id, user_id, data: ing });
  if (error) throw error;
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) throw error;
}

export async function getDishes(): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('data')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => r.data as Dish);
}

export async function saveDish(dish: Dish): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  const { error } = await supabase
    .from('dishes')
    .upsert({ id: dish.id, user_id, data: dish, updated_at: new Date(dish.updatedAt).toISOString() });
  if (error) throw error;
}

export async function deleteDish(id: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', id);
  if (error) throw error;
}
