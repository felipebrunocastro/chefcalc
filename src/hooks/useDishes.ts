import { useState, useEffect, useCallback } from 'react';
import { getDishes, saveDish, deleteDish } from '../data/repo';
import { useRestaurant } from './useRestaurant';
import type { Dish } from '../types';

// Escopo: sempre o restaurante aberto. Sem restaurante, lista vazia.
export function useDishes() {
  const { current } = useRestaurant();
  const rid = current?.id;
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!rid) { setDishes([]); setLoading(false); return; }
    try {
      setDishes(await getDishes(rid));
    } catch {
      setDishes([]);
    }
    setLoading(false);
  }, [rid]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const save = useCallback(async (item: Dish) => {
    if (!rid) throw new Error('no restaurant');
    await saveDish(rid, item);
    await load();
  }, [rid, load]);

  const remove = useCallback(async (id: string) => {
    if (!rid) return;
    await deleteDish(rid, id);
    await load();
  }, [rid, load]);

  return { dishes, loading, save, remove, reload: load };
}
