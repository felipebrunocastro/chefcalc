import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

export function AuthScreen() {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) { setError(error); return; }
    if (mode === 'signup') {
      setInfo(t('auth.checkEmail'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="absolute top-4 right-4"><LanguageSwitcher /></div>

      <div className="flex items-center gap-2 mb-8">
        <ChefHat size={30} className="text-amber-500" />
        <span className="text-2xl font-bold text-gray-900">ChefCalc</span>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 w-full max-w-sm">
        <h1 className="text-lg font-bold text-gray-900 mb-5">
          {mode === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
        </h1>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('auth.email')}</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('auth.password')}</label>
            <input
              type="password" required minLength={6} value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        {info && <p className="text-sm text-emerald-600 mb-3">{info}</p>}

        <button
          type="submit" disabled={busy}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
        >
          {busy ? '...' : mode === 'login' ? t('auth.login') : t('auth.signup')}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
          className="w-full mt-3 text-sm text-amber-600 hover:text-amber-700"
        >
          {mode === 'login' ? t('auth.needAccount') : t('auth.haveAccount')}
        </button>
      </form>
    </div>
  );
}
