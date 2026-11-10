import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, Store } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { acceptInvite, inviteInfo } from '../../data/posRepo';
import { navigate } from '../../lib/router';
import { AuthScreen } from './AuthScreen';
import { Logo } from '../ui/Logo';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

export function AcceptInvite() {
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [info, setInfo] = useState<Awaited<ReturnType<typeof inviteInfo>> | 'invalid' | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { inviteInfo(token).then(i => setInfo(i ?? 'invalid')).catch(() => setInfo('invalid')); }, [token]);

  if (loading || info === null) return <div className="min-h-screen" aria-busy="true" />;
  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <div className="absolute top-4 right-4"><LanguageSwitcher tone="light" /></div>
      <Logo height={34} />
      <div className="card p-6 w-full max-w-md space-y-4">{body}</div>
    </div>
  );
  if (info === 'invalid' || info.expired) return shell(<p className="text-red-700 flex gap-2"><AlertTriangle size={18} className="shrink-0" /> {t('invite.invalid')}</p>);

  const header = (
    <>
      <h1 className="text-xl font-bold text-navy-900">{t('invite.title')}</h1>
      <p className="text-slate-700 flex gap-2"><Store size={18} className="text-blue-600 shrink-0 mt-0.5" /> {t('invite.for', { role: t(`team.roles.${info.role}`), name: info.restaurantName })}</p>
      {info.unit && <p className="text-sm text-slate-600">{t('invite.unitLine', { unit: info.unit })}</p>}
    </>
  );

  if (!user) return (
    <div>
      <div className="max-w-md mx-auto pt-6 px-4">
        <div className="card p-4 space-y-2">{header}<p className="text-sm text-blue-900">{t('invite.loginFirst', { email: info.email })}</p></div>
      </div>
      <AuthScreen initialMode="login" initialEmail={info.email} embedded />
    </div>
  );

  if ((user.email ?? '').toLowerCase() !== info.email) return shell(<>
    {header}
    <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">{t('invite.wrongEmail', { current: user.email, email: info.email })}</p>
    <button onClick={signOut} className="btn-secondary w-full">{t('invite.signOut')}</button>
  </>);

  const accept = async () => {
    setState('busy');
    try {
      const rid = await acceptInvite(token);
      localStorage.setItem(`chefcalc:restaurant:${user.id}`, rid);
      setState('done');
    } catch (e) { setError((e as Error).message); setState('error'); }
  };

  return shell(<>
    {header}
    {state === 'done' ? (
      <>
        <p className="text-emerald-800 font-semibold flex gap-2" role="status"><CheckCircle2 size={18} /> {t('invite.accepted')}</p>
        <button onClick={() => navigate('/app')} className="btn-primary w-full !py-3 text-base">{t('invite.go')}</button>
      </>
    ) : (
      <>
        {state === 'error' && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button onClick={accept} disabled={state === 'busy'} className="btn-primary w-full !py-3 text-base">{t('invite.accept')}</button>
      </>
    )}
  </>);
}
