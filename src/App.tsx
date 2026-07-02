import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { IngredientsPage } from './components/ingredients/IngredientsPage';
import { DishPage } from './components/dish/DishPage';
import { SimulatorPage } from './components/simulator/SimulatorPage';
import { ExportPage } from './components/export/ExportPage';
import type { AppView } from './types';

export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [editingDishId, setEditingDishId] = useState<string | undefined>();

  const navigate = (nextView: AppView, dishId?: string) => {
    setView(nextView);
    setEditingDishId(dishId);
  };

  return (
    <Layout current={view} onNavigate={v => navigate(v)}>
      {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
      {view === 'ingredients' && <IngredientsPage />}
      {view === 'dish' && <DishPage dishId={editingDishId} onNavigate={navigate} />}
      {view === 'simulator' && <SimulatorPage />}
      {view === 'export' && <ExportPage />}
    </Layout>
  );
}
