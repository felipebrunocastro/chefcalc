import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from '../pos/Modal';
import { RestaurantLogo } from './RestaurantLogo';
import type { Restaurant } from '../../types';

export const TRASH_DAYS = 90;
const DAY = 86400000;

export function daysLeft(deletedAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(deletedAt) + TRASH_DAYS * DAY - now) / DAY));
}

// Confirmação de exclusão: só libera quando o nome digitado confere (o banco confere de novo).
export function DeleteRestaurantDialog({ restaurant, onCancel, onConfirm }: {
  restaurant: Restaurant; onCancel: () => void; onConfirm: (typedName: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === restaurant.name.trim();

  const submit = async () => {
    if (!matches || busy) return;
    setBusy(true); setError(null);
    try { await onConfirm(typed); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <Modal title={t('restaurants.deleteTitle')} onClose={onCancel} footer={<>
      <button onClick={onCancel} className="btn-secondary !py-3">{t('restaurants.cancel')}</button>
      <button onClick={submit} disabled={!matches || busy} className="btn-primary !py-3 !px-6 !bg-red-600 hover:!bg-red-700 disabled:!bg-red-300">
        <Trash2 size={16} /> {busy ? t('restaurants.deleting') : t('restaurants.deleteConfirmBtn')}
      </button>
    </>}>
      <div className="flex gap-3 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-900">
        <AlertTriangle size={20} className="shrink-0 text-red-600" />
        <div className="space-y-1">
          <p className="font-semibold">{t('restaurants.deleteWarn', { name: restaurant.name })}</p>
          <p>{t('restaurants.deleteKeep', { days: TRASH_DAYS })}</p>
          <p>{t('restaurants.deleteShared')}</p>
        </div>
      </div>
      <div>
        <label htmlFor="del-confirm" className="block text-sm text-slate-700 mb-1">
          {t('restaurants.typeToConfirm')} <b className="select-all text-navy-900">{restaurant.name}</b>
        </label>
        <input id="del-confirm" value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          autoComplete="off" spellCheck={false} className="field !py-3 text-base" aria-invalid={typed.length > 0 && !matches} />
        {typed.length > 0 && !matches && <p className="text-xs text-slate-500 mt-1">{t('restaurants.nameMismatch')}</p>}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </Modal>
  );
}

// "Excluídos recentemente": reativar dentro de 90 dias.
export function DeletedRestaurants({ list, onRestore }: { list: Restaurant[]; onRestore: (id: string) => Promise<boolean> }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (list.length === 0 && !msg) return null;

  const restore = async (r: Restaurant) => {
    setBusy(r.id); setMsg(null);
    try {
      const ok = await onRestore(r.id);
      setMsg(ok ? { ok: true, text: t('restaurants.restored', { name: r.name }) } : { ok: false, text: t('restaurants.restoreExpired') });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null);
  };

  return (
    <section className="mt-10" aria-labelledby="trash-h" data-testid="trash">
      <h2 id="trash-h" className="text-lg font-semibold text-navy-900">{t('restaurants.trashTitle')}</h2>
      <p className="text-sm text-slate-500 mb-3">{t('restaurants.trashHint', { days: TRASH_DAYS })}</p>
      {msg && <p className={`text-sm mb-3 ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status">{msg.text}</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(r => {
          const left = daysLeft(r.deletedAt!);
          return (
            <li key={r.id} className="card p-4 flex items-center gap-3 border-dashed opacity-90">
              <RestaurantLogo restaurant={r} size={48} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy-900 truncate">{r.name}</p>
                <p className="text-xs text-slate-500">{t('restaurants.deletedOn', { date: new Date(r.deletedAt!).toLocaleDateString(locale) })}</p>
                <p className={`text-xs font-medium ${left <= 7 ? 'text-red-600' : 'text-amber-700'}`}>{t('restaurants.daysLeft', { count: left })}</p>
              </div>
              <button onClick={() => restore(r)} disabled={busy === r.id} className="btn-secondary shrink-0" aria-label={`${t('restaurants.restore')}: ${r.name}`}>
                <RotateCcw size={15} /> {t('restaurants.restore')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
