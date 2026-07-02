import Dexie, { type Table } from 'dexie';
import type { Ingredient, Dish } from '../types';

class RestaurantDB extends Dexie {
  ingredients!: Table<Ingredient>;
  dishes!: Table<Dish>;

  constructor() {
    super('RestaurantFichaDB');
    this.version(1).stores({
      ingredients: 'id, nome.pt, fornecedor, createdAt',
      dishes: 'id, nome.pt, categoria, createdAt, updatedAt',
    });
  }
}

export const db = new RestaurantDB();

export async function exportBackup(): Promise<string> {
  const ingredients = await db.ingredients.toArray();
  const dishes = await db.dishes.toArray();
  return JSON.stringify({ ingredients, dishes, exportedAt: Date.now() }, null, 2);
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction('rw', db.ingredients, db.dishes, async () => {
    if (data.ingredients) await db.ingredients.bulkPut(data.ingredients);
    if (data.dishes) await db.dishes.bulkPut(data.dishes);
  });
}
