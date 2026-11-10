import { useState, useEffect, useCallback } from 'react';
import { getIngredients, saveIngredient, deleteIngredient } from '../data/repo';
import { useRestaurant } from './useRestaurant';
import type { Ingredient } from '../types';

// Escopo: sempre o restaurante aberto. Sem restaurante, lista vazia.
export function useIngredients() {
  const { current } = useRestaurant();
  const rid = current?.id;
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!rid) { setIngredients([]); setLoading(false); return; }
    try {
      setIngredients(await getIngredients(rid));
    } catch {
      setIngredients([]);
    }
    setLoading(false);
  }, [rid]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const save = useCallback(async (item: Ingredient) => {
    if (!rid) throw new Error('no restaurant');
    await saveIngredient(rid, item);
    await load();
  }, [rid, load]);

  const remove = useCallback(async (id: string) => {
    if (!rid) return;
    await deleteIngredient(rid, id);
    await load();
  }, [rid, load]);

  return { ingredients, loading, save, remove, reload: load };
}
