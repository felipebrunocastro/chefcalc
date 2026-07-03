import { useState, useEffect, useCallback } from 'react';
import { getIngredients, saveIngredient, deleteIngredient } from '../data/repo';
import { useAuth } from './useAuth';
import type { Ingredient } from '../types';

export function useIngredients() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setIngredients([]); setLoading(false); return; }
    try {
      setIngredients(await getIngredients());
    } catch {
      setIngredients([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (ing: Ingredient) => {
    await saveIngredient(ing);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await deleteIngredient(id);
    await load();
  }, [load]);

  return { ingredients, loading, save, remove, reload: load };
}
