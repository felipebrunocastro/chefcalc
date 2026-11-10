import { v4 as uuidv4 } from 'uuid';
import { getIngredients, saveIngredient, getDishes, saveDish } from '../data/repo';
import type { Dish, Ingredient } from '../types';

// Backup do restaurante aberto (insumos + fichas).
export async function exportBackup(restaurantId: string, restaurantName: string): Promise<string> {
  const [ingredients, dishes] = await Promise.all([getIngredients(restaurantId), getDishes(restaurantId)]);
  return JSON.stringify({ restaurant: restaurantName, ingredients, dishes, exportedAt: Date.now() }, null, 2);
}

// Importa como cópia no restaurante aberto: gera IDs novos e refaz os vínculos
// ficha → insumo, para nunca mover registros de outro restaurante.
export async function importBackup(restaurantId: string, json: string): Promise<void> {
  const data = JSON.parse(json);
  const idMap = new Map<string, string>();
  if (Array.isArray(data.ingredients)) {
    for (const ing of data.ingredients as Ingredient[]) {
      const id = uuidv4();
      idMap.set(ing.id, id);
      await saveIngredient(restaurantId, { ...ing, id });
    }
  }
  if (Array.isArray(data.dishes)) {
    for (const dish of data.dishes as Dish[]) {
      await saveDish(restaurantId, {
        ...dish,
        id: uuidv4(),
        itens: (dish.itens || []).map(it => ({ ...it, ingredienteId: idMap.get(it.ingredienteId) ?? '' })),
        updatedAt: Date.now(),
      });
    }
  }
}
