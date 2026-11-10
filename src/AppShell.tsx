import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout, allowedViews } from './components/Layout';
import { SheetView } from './components/dish/SheetView';
import { ProfilePage } from './components/profile/ProfilePage';
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
export { AcceptInvite } from './components/auth/AcceptInvite';
import { PosPage } from './components/pos/PosPage';
import { useAuth } from './hooks/useAuth';
import { RestaurantProvider, useRestaurant } from './hooks/useRestaurant';
import { useSubscription } from './hooks/useSubscription';
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
  const { current, guard, loading, select, revoked, reload } = useRestaurant();

  // "Abrir meu painel" (landing) e retorno do OAuth do Square.
  useEffect(() => {
    if (sessionStorage.getItem('chefcalc:openPanel')) { sessionStorage.removeItem('chefcalc:openPanel'); select(null); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<AppView>('home');
  const [editingDishId, setEditingDishId] = useState<string | undefined>();
  const [printIds, setPrintIds] = useState<string[] | undefined>();

  const allowed = current ? allowedViews(current.role) : null;
  const readOnly = !!current && current.role !== 'owner';

  // Ao abrir/trocar de restaurante, começa pela visão geral (ou pelas fichas, se for acesso compartilhado).
  useEffect(() => {
    if (current && new URLSearchParams(window.location.search).get('integration')) { setView('finance'); return; }
    setView(!current ? 'home' : current.role === 'operator' ? 'pos' : current.role !== 'owner' ? 'dashboard' : 'home');
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
          {readOnly && view !== 'dashboard' && view !== 'sheet' && view !== 'finance' && view !== 'pos' ? null : <>
          {view === 'pos' && (current.role === 'owner' || current.role === 'operator') && <PosPage />}
          {view === 'home' && <RestaurantHome onNavigate={navigate} />}
          {view === 'dashboard' && <Dashboard readOnly={readOnly} onNavigate={navigate} onPrint={ids => { setPrintIds(ids); navigate('export'); }} />}
          {view === 'sheet' && <SheetView dishId={editingDishId} onNavigate={navigate} />}
          {view === 'ingredients' && <IngredientsPage />}
          {view === 'shopping' && <ShoppingListPage />}
          {view === 'dish' && <DishPage key={editingDishId ?? 'new'} dishId={editingDishId} onNavigate={navigate} />}
          {view === 'simulator' && <SimulatorPage />}
          {view === 'converter' && <ConverterPage />}
          {view === 'profile' && !readOnly && <ProfilePage />}
          {view === 'finance' && (!readOnly || current.role === 'finance' || current.role === 'operator') && <FinancePage readOnly={current.role === 'operator'} />}
          {view === 'export' && <ExportPage initialSelection={printIds} />}
          </>}
          {!readOnly && <ConverterFab />}
          {revoked && <RevokedOverlay onBack={async () => { await reload(); select(null); }} />}
        </div>
      )}
    </Layout>
  );
}

export function AppArea({ authMode }: { authMode?: 'login' | 'signup' }) {
  const { user, loading } = useAuth();
  const { status, isActive } = useSubscription();

  // Paywall só entra em vigor quando VITE_REQUIRE_SUBSCRIPTION === 'true'.
  const requireSubscription = import.meta.env.VITE_REQUIRE_SUBSCRIPTION === 'true';

  if (loading) return <Loading />;
  if (!user) return <AuthScreen initialMode={authMode} />;
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

function RevokedOverlay({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[80] bg-navy-950/80 backdrop-blur flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="revoked-h">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-3 text-center">
        <h2 id="revoked-h" className="text-xl font-bold text-navy-900">{t('revoked.title')}</h2>
        <p className="text-slate-700">{t('revoked.text')}</p>
        <button onClick={onBack} className="btn-primary w-full !py-3">{t('revoked.back')}</button>
      </div>
    </div>
  );
}
