import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { Ingredient } from '../types';

export function useIngredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const all = await db.ingredients.orderBy('createdAt').toArray();
    setIngredients(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (ing: Ingredient) => {
    await db.ingredients.put(ing);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await db.ingredients.delete(id);
    await load();
  }, [load]);

  return { ingredients, loading, save, remove, reload: load };
}
