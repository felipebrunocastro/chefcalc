import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout, allowedViews } from './components/Layout';
import { SheetView } from './components/dish/SheetView';
import { Dashboard } from './components/dashboard/Dashboard';
import { IngredientsPage } from './components/ingredients/IngredientsPage';
import { ShoppingListPage } from './components/shopping/ShoppingListPage';
import { DishPage } from './components/dish/DishPage';
import { SimulatorPage } from './components/simulator/SimulatorPage';
import { ConverterPage } from './components/converter/ConverterPage';
import { ConverterFab } from './components/converter/ConverterFab';
import { ExportPage } from './components/export/ExportPage';
import { FinancePage } from './components/finance/FinancePage';
import { RestaurantHome } from './components/home/RestaurantHome';
import { RestaurantsPanel } from './components/restaurants/RestaurantsPanel';
import { AuthScreen } from './components/auth/AuthScreen';
import { Paywall } from './components/auth/Paywall';
import { Mascot } from './components/ui/Mascot';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { RestaurantProvider, useRestaurant } from './hooks/useRestaurant';
import { useSubscription } from './hooks/useSubscription';
import { isSupabaseConfigured } from './lib/supabase';
import type { AppView } from './types';

function Loading() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500" aria-busy="true">
      <Mascot size={72} className="animate-pulse" decorative />
      <span className="text-sm">{t('common.loading')}</span>
    </div>
  );
}

function Workspace() {
  const { current, guard, loading } = useRestaurant();
  const [view, setView] = useState<AppView>('home');
  const [editingDishId, setEditingDishId] = useState<string | undefined>();
  const [printIds, setPrintIds] = useState<string[] | undefined>();

  const allowed = current ? allowedViews(current.role) : null;
  const readOnly = !!current && current.role !== 'owner';

  // Ao abrir/trocar de restaurante, começa pela visão geral (ou pelas fichas, se for acesso compartilhado).
  useEffect(() => {
    setView(current && current.role !== 'owner' ? 'dashboard' : 'home');
    setEditingDishId(undefined); setPrintIds(undefined);
  }, [current?.id, current?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toda navegação passa pela proteção de alterações não salvas e pelo papel do usuário.
  const navigate = (nextView: AppView, dishId?: string) => guard(() => {
    if (allowed && !allowed.includes(nextView) && !(nextView === 'sheet')) nextView = 'dashboard';
    setView(nextView);
    setEditingDishId(dishId);
    if (nextView !== 'export') setPrintIds(undefined);
  });

  if (loading) return <Loading />;

  return (
    <Layout current={view} onNavigate={v => navigate(v)}>
      {!current ? (
        <RestaurantsPanel />
      ) : (
        <div key={current.id}>
          {readOnly && view !== 'dashboard' && view !== 'sheet' && view !== 'finance' ? null : <>
          {view === 'home' && <RestaurantHome onNavigate={navigate} />}
          {view === 'dashboard' && <Dashboard readOnly={readOnly} onNavigate={navigate} onPrint={ids => { setPrintIds(ids); navigate('export'); }} />}
          {view === 'sheet' && <SheetView dishId={editingDishId} onNavigate={navigate} />}
          {view === 'ingredients' && <IngredientsPage />}
          {view === 'shopping' && <ShoppingListPage />}
          {view === 'dish' && <DishPage key={editingDishId ?? 'new'} dishId={editingDishId} onNavigate={navigate} />}
          {view === 'simulator' && <SimulatorPage />}
          {view === 'converter' && <ConverterPage />}
          {view === 'finance' && (!readOnly || current.role === 'finance') && <FinancePage />}
          {view === 'export' && <ExportPage initialSelection={printIds} />}
          </>}
          {!readOnly && <ConverterFab />}
        </div>
      )}
    </Layout>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  const { status, isActive } = useSubscription();

  // Paywall só entra em vigor quando VITE_REQUIRE_SUBSCRIPTION === 'true'.
  const requireSubscription = import.meta.env.VITE_REQUIRE_SUBSCRIPTION === 'true';

  if (loading) return <Loading />;
  if (!user) return <AuthScreen />;
  if (requireSubscription) {
    if (status === 'loading') return <Loading />;
    if (!isActive) return <Paywall />;
  }

  return (
    <RestaurantProvider>
      <Workspace />
    </RestaurantProvider>
  );
}

function NotConfigured() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
      <Mascot size={80} decorative />
      <h1 className="text-lg font-bold text-navy-900">ChefCalc</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.
      </p>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
