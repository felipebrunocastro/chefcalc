import { useState, useEffect, useCallback } from 'react';
import { getDishes, saveDish, deleteDish } from '../data/repo';
import { useAuth } from './useAuth';
import type { Dish } from '../types';

export function useDishes() {
  const { user } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setDishes([]); setLoading(false); return; }
    try {
      setDishes(await getDishes());
    } catch {
      setDishes([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (dish: Dish) => {
    await saveDish(dish);
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await deleteDish(id);
    await load();
  }, [load]);

  return { dishes, loading, save, remove, reload: load };
}
