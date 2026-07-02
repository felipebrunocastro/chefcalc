import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { Dish } from '../types';

export function useDishes() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const all = await db.dishes.orderBy('updatedAt').reverse().toArray();
    setDishes(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (dish: Dish) => {
    await db.dishes.put(dish);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await db.dishes.delete(id);
    await load();
  }, [load]);

  return { dishes, loading, save, remove, reload: load };
}
