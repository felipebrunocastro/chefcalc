import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, UserPlus, Trash2, Eye, Wallet, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getMembers, saveMember, removeMember } from '../../data/repo';
import type { MemberRole, Restaurant, RestaurantMember } from '../../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareDialog({ restaurant, onClose }: { restaurant: Restaurant; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [members, setMembers] = useState<RestaurantMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('viewer');
  const [error, setError] = useState('');
  const [setupMissing, setSetupMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setMembers(await getMembers(restaurant.id)); setSetupMissing(false); }
    catch { setSetupMissing(true); }
  }, [restaurant.id]);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) { setError(t('share.invalidEmail')); return; }
    if (clean === (user?.email ?? '').toLowerCase()) { setError(t('share.selfEmail')); return; }
    setBusy(true); setError('');
    try { await saveMember(restaurant.id, clean, role); setEmail(''); await load(); }
    catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  const roleOptions: { id: MemberRole; icon: typeof Eye }[] = [{ id: 'viewer', icon: Eye }, { id: 'finance', icon: Wallet }];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-6 max-h-[92svh] overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 id="share-title" className="text-lg font-bold text-navy-900">{t('share.title', { name: restaurant.name })}</h2>
          <button onClick={onClose} className="btn-ghost" aria-label={t('share.close')}><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-600 mb-4">{t('share.hint')}</p>

        {setupMissing && (
          <p className="flex gap-2 text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 mb-4" role="alert">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {t('share.setupHint')}
          </p>
        )}

        <form onSubmit={add} className="space-y-3 mb-5">
          <div>
            <label className="label" htmlFor="share-email">{t('share.email')}</label>
            <input id="share-email" type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} className="field" placeholder="nome@email.com" />
          </div>
          <fieldset>
            <legend className="label">{t('share.role')}</legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {roleOptions.map(({ id, icon: Icon }) => (
                <label key={id} className={`cursor-pointer rounded-xl border p-3 ${role === id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-blue-50'}`}>
                  <input type="radio" name="share-role" value={id} checked={role === id} onChange={() => setRole(id)} className="sr-only" />
                  <span className="flex items-center gap-1.5 font-semibold text-navy-900 text-sm"><Icon size={15} /> {t(`share.${id}`)}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{t(`share.${id}Hint`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={busy || setupMissing} className="btn-primary w-full"><UserPlus size={15} /> {t('share.add')}</button>
          <p className="text-xs text-slate-500">{t('share.howTo')}</p>
        </form>

        <h3 className="label">{t('share.people')}</h3>
        {members.length === 0 ? (
          <p className="text-sm text-slate-400">{t('share.none')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {members.map(m => (
              <li key={m.email} className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-navy-900 truncate">{m.email}</div>
                  <div className="text-xs text-slate-500">{t(`roles.${m.role}`)}</div>
                </div>
                <select
                  aria-label={`${t('share.role')}: ${m.email}`}
                  value={m.role}
                  onChange={async e => { await saveMember(restaurant.id, m.email, e.target.value as MemberRole); load(); }}
                  className="field !w-auto !py-1 text-xs"
                >
                  <option value="viewer">{t('share.viewer')}</option>
                  <option value="finance">{t('share.finance')}</option>
                </select>
                <button onClick={async () => { await removeMember(restaurant.id, m.email); load(); }} className="btn-ghost hover:!text-red-600" aria-label={`${t('share.remove')}: ${m.email}`} title={t('share.remove')}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
