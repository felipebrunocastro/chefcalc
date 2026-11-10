import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { CURRENCIES, type Currency } from '../../lib/currency';
import { fileToLogoDataUrl } from '../../lib/logo';
import { RestaurantLogo } from './RestaurantLogo';
import type { Restaurant } from '../../types';

interface Props {
  initial?: Restaurant;
  onSubmit: (v: { name: string; currency: Currency; logo: string | null }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

export function RestaurantForm({ initial, onSubmit, onCancel, onDelete }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'USD');
  const [logo, setLogo] = useState<string | null>(initial?.logo ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setLogo(await fileToLogoDataUrl(f)); setError(''); }
    catch { setError(t('restaurants.logoError')); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t('restaurants.nameRequired')); return; }
    setBusy(true);
    try { await onSubmit({ name: name.trim(), currency, logo }); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="rf-title">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-6 max-h-[92svh] overflow-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 id="rf-title" className="text-lg font-bold text-navy-900">{initial ? t('restaurants.edit') : t('restaurants.new')}</h2>
          <button type="button" onClick={onCancel} className="btn-ghost" aria-label={t('restaurants.cancel')}><X size={18} /></button>
        </div>

        <label className="label" htmlFor="rf-name">{t('restaurants.name')} *</label>
        <input id="rf-name" autoFocus required value={name} onChange={e => setName(e.target.value)} className="field mb-4" maxLength={80} />

        <label className="label" htmlFor="rf-cur">{t('restaurants.currency')}</label>
        <select id="rf-cur" value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="field">
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
        </select>
        <p className="text-xs text-slate-500 mt-1 mb-4">{t('restaurants.currencyHint')}</p>

        <span className="label">{t('restaurants.logo')}</span>
        <div className="flex items-center gap-4 mb-1">
          <RestaurantLogo restaurant={{ name: name || '?', logo }} size={72} />
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary">
              <ImagePlus size={15} /> {logo ? t('restaurants.replaceLogo') : t('restaurants.uploadLogo')}
            </button>
            {logo && (
              <button type="button" onClick={() => setLogo(null)} className="btn-secondary text-red-600">
                <Trash2 size={15} /> {t('restaurants.removeLogo')}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={pick} />
        </div>
        <p className="text-xs text-slate-500 mb-4">{t('restaurants.logoHint')}</p>

        {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}

        <div className="flex flex-wrap gap-2 justify-end">
          {onDelete && <button type="button" onClick={onDelete} className="btn-secondary text-red-600 mr-auto">{t('restaurants.delete')}</button>}
          <button type="button" onClick={onCancel} className="btn-secondary">{t('restaurants.cancel')}</button>
          <button type="submit" disabled={busy} className="btn-primary">{busy ? t('restaurants.saving') : t('restaurants.save')}</button>
        </div>
      </form>
    </div>
  );
}
