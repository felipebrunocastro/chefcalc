import { useState, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat } from 'lucide-react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { IngredientsPage } from './components/ingredients/IngredientsPage';
import { DishPage } from './components/dish/DishPage';
import { SimulatorPage } from './components/simulator/SimulatorPage';
import { ExportPage } from './components/export/ExportPage';
import { AuthScreen } from './components/auth/AuthScreen';
import { Paywall } from './components/auth/Paywall';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';
import { isSupabaseConfigured } from './lib/supabase';
import type { AppView } from './types';

function Loading() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400">
      <ChefHat size={32} className="text-amber-400 animate-pulse" />
      <span className="text-sm">{t('common.loading')}</span>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  const { status, isActive } = useSubscription();
  const [view, setView] = useState<AppView>('dashboard');
  const [editingDishId, setEditingDishId] = useState<string | undefined>();
  const [, forceUpdate] = useReducer(x => x + 1, 0); // re-render ao trocar de moeda

  const navigate = (nextView: AppView, dishId?: string) => {
    setView(nextView);
    setEditingDishId(dishId);
  };

  // Paywall só entra em vigor quando VITE_REQUIRE_SUBSCRIPTION === 'true'.
  // Enquanto o Stripe não está ligado, deixe desligado para usar o app livremente.
  const requireSubscription = import.meta.env.VITE_REQUIRE_SUBSCRIPTION === 'true';

  if (loading) return <Loading />;
  if (!user) return <AuthScreen />;
  if (requireSubscription) {
    if (status === 'loading') return <Loading />;
    if (!isActive) return <Paywall />;
  }

  return (
    <Layout current={view} onNavigate={v => navigate(v)} onCurrencyChange={forceUpdate}>
      {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
      {view === 'ingredients' && <IngredientsPage />}
      {view === 'dish' && <DishPage dishId={editingDishId} onNavigate={navigate} />}
      {view === 'simulator' && <SimulatorPage />}
      {view === 'export' && <ExportPage />}
    </Layout>
  );
}

function NotConfigured() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
      <ChefHat size={32} className="text-amber-500" />
      <h1 className="text-lg font-bold text-gray-900">ChefCalc</h1>
      <p className="text-sm text-gray-500 max-w-sm">
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
