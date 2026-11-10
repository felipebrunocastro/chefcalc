import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './lib/supabase';
import { navigate, usePath } from './lib/router';
import { LandingPage } from './components/landing/LandingPage';
import { Mascot } from './components/ui/Mascot';

// O app (painel) só é baixado quando o visitante entra; a landing fica leve.
const AppArea = lazy(() => import('./AppShell').then(m => ({ default: m.AppArea })));
const AcceptInvite = lazy(() => import('./AppShell').then(m => ({ default: m.AcceptInvite })));

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center" aria-busy="true">
      <Mascot size={72} className="animate-pulse" decorative />
    </div>
  );
}

function Routes() {
  const path = usePath();
  const { user, loading } = useAuth();
  const isAuthRoute = path === '/entrar' || path === '/cadastro';

  // Já autenticado em /entrar ou /cadastro → painel.
  useEffect(() => { if (!loading && user && isAuthRoute) navigate('/app', { replace: true }); }, [loading, user, isAuthRoute]);

  if (path === '/convite') return <Suspense fallback={<Splash />}><AcceptInvite /></Suspense>;
  if (path === '/app' || isAuthRoute) {
    return (
      <Suspense fallback={<Splash />}>
        <AppArea authMode={path === '/cadastro' ? 'signup' : 'login'} />
      </Suspense>
    );
  }
  return <LandingPage />;
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
      <Routes />
    </AuthProvider>
  );
}
