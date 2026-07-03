import { getIngredients, saveIngredient, getDishes, saveDish } from '../data/repo';

export async function exportBackup(): Promise<string> {
  const [ingredients, dishes] = await Promise.all([getIngredients(), getDishes()]);
  return JSON.stringify({ ingredients, dishes, exportedAt: Date.now() }, null, 2);
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (Array.isArray(data.ingredients)) {
    for (const ing of data.ingredients) await saveIngredient(ing);
  }
  if (Array.isArray(data.dishes)) {
    for (const dish of data.dishes) await saveDish(dish);
  }
}
