import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat, Check, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

export function Paywall() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const subscribe = async () => {
    setBusy(true); setError('');
    try {
      // Supabase Edge Function creates a Stripe Checkout session and returns its URL
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { returnUrl: window.location.origin },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar pagamento');
      setBusy(false);
    }
  };

  const features = [
    t('paywall.feat1'),
    t('paywall.feat2'),
    t('paywall.feat3'),
    t('paywall.feat4'),
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <LanguageSwitcher />
        <button onClick={signOut} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <LogOut size={14} /> {t('auth.signOut')}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <ChefHat size={30} className="text-amber-500" />
        <span className="text-2xl font-bold text-gray-900">ChefCalc</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-1">{t('paywall.title')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('paywall.subtitle')}</p>

        <div className="mb-6">
          <span className="text-4xl font-bold text-gray-900">$99,99</span>
          <span className="text-gray-500 text-sm">/{t('paywall.year')}</span>
        </div>

        <ul className="text-left space-y-2 mb-6">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <Check size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <button
          onClick={subscribe} disabled={busy}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
        >
          {busy ? '...' : t('paywall.subscribe')}
        </button>

        <p className="text-xs text-gray-400 mt-4">{user?.email}</p>
      </div>
    </div>
  );
}
