import { supabase } from '../lib/supabase';

// Painel administrativo (migração 007). A permissão é verificada no banco:
// admin_overview() recusa qualquer conta que não esteja em app_admins.

export interface AdminRestaurant { id: string; name: string; createdAt: string; deletedAt?: string | null; dishes: number; ingredients: number; members: number }
export interface AdminUser {
  id: string; email: string; createdAt: string; lastSignInAt: string | null; confirmed: boolean; isAdmin: boolean;
  restaurantCount: number; dishCount: number; ingredientCount: number; sharedCount: number;
  restaurants: AdminRestaurant[];
}
export interface AdminOverview {
  generatedAt: string;
  totals: {
    users: number; confirmedUsers: number; newUsers7: number; newUsers30: number; active7: number;
    usersWithRestaurant: number; restaurants: number; deletedRestaurants?: number; dishes: number; ingredients: number;
  };
  users: AdminUser[];
}

// Tolerante: antes da migração 007 a função não existe → não é admin.
export async function isAppAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_app_admin');
  if (error) return false;
  return data === true;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw error;
  return data as AdminOverview;
}
