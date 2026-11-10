import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import {
  Save, Check, ImagePlus, Trash2, Plus, Star, ExternalLink, Copy, Download, Lock, ChevronDown,
} from 'lucide-react';
import { useRestaurant } from '../../hooks/useRestaurant';
import { getRestaurantPrivate, saveRestaurantPrivate } from '../../data/repo';
import { fileToLogoDataUrl } from '../../lib/logo';
import { RestaurantLogo } from '../restaurants/RestaurantLogo';
import { DEFAULT_DELIVERY, BASE_CHANNELS } from '../../utils/breakeven';
import { profileCompletion } from '../../utils/profile';
import type {
  DayHours, EstablishmentType, RestaurantPrivate, RestaurantProfile, ServiceMode, ServiceSegment, Weekday,
} from '../../types';

const TYPES: EstablishmentType[] = ['restaurant', 'snackbar', 'cafe', 'bakery', 'confectionery', 'foodtruck', 'kiosk', 'icecream', 'bar', 'catering', 'ghostkitchen', 'other'];
const CUISINES = ['dominican', 'brazilian', 'colombian', 'mexican', 'puertorican', 'american', 'italian', 'asian', 'fusion'];
const MODES: ServiceMode[] = ['table', 'counter', 'buffet', 'pickup', 'delivery', 'drivethru', 'catering'];
const SEGMENTS: ServiceSegment[] = ['full', 'limited', 'other'];
const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const REVIEW_HELP_URL = 'https://support.google.com/business/answer/16816815';

const isUrl = (u?: string) => !!u && /^https?:\/\/\S+$/i.test(u.trim());
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function Section({ id, title, children, defaultOpen = false }: { id: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details id={`profile-${id}`} className="card group" open={defaultOpen}>
      <summary className="list-none cursor-pointer select-none flex items-center gap-2 px-4 md:px-5 py-4 font-semibold text-navy-900 rounded-2xl hover:bg-blue-50/60">
        {title}
        <ChevronDown size={16} className="ml-auto text-blue-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-4 md:px-5 pb-5 pt-1 space-y-4">{children}</div>
    </details>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, className = '', multiline = false }: {
  label: string; value?: string | number | null; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; multiline?: boolean;
}) {
  const id = useMemo(() => 'f-' + Math.random().toString(36).slice(2, 9), []);
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      {multiline
        ? <textarea id={id} rows={4} value={value ?? ''} onChange={e => onChange(e.target.value)} className="field" placeholder={placeholder} />
        : <input id={id} type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className="field" placeholder={placeholder} inputMode={type === 'number' ? 'decimal' : undefined} />}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-sm border ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50'}`}>
      {children}
    </button>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { current: restaurant, update } = useRestaurant();
  const [name, setName] = useState(restaurant?.name ?? '');
  const [logo, setLogo] = useState<string | null>(restaurant?.logo ?? null);
  const [p, setP] = useState<RestaurantProfile>(() => structuredClone(restaurant?.profile ?? {}));
  const [priv, setPriv] = useState<RestaurantPrivate>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [newCuisine, setNewCuisine] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurant) return;
    getRestaurantPrivate(restaurant.id).then(setPriv).catch(() => setPriv({}));
  }, [restaurant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // QR code gerado exatamente com o endereço colado.
  useEffect(() => {
    const url = p.googleReviewUrl?.trim();
    if (!isUrl(url)) { setQr(null); return; }
    QRCode.toDataURL(url!, { width: 512, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(null));
  }, [p.googleReviewUrl]);

  if (!restaurant) return null;

  const set = <K extends keyof RestaurantProfile>(k: K, v: RestaurantProfile[K]) => setP(x => ({ ...x, [k]: v }));
  const toggleIn = <T,>(list: T[] | undefined, v: T) => (list ?? []).includes(v) ? (list ?? []).filter(x => x !== v) : [...(list ?? []), v];
  const delivery = p.delivery?.length ? p.delivery : DEFAULT_DELIVERY;
  const channelName = (id: string, fallback?: string) => fallback || (t(`channels.${id}`) as string);
  const hours = (d: Weekday): DayHours => p.hours?.[d] ?? { closed: false, shifts: [] };
  const setHours = (d: Weekday, h: DayHours) => set('hours', { ...(p.hours ?? {}), [d]: h });
  const cuisineLabel = (c: string) => (CUISINES.includes(c) ? t(`profile.cuisineList.${c}`) : c);
  const pct = profileCompletion({ ...restaurant, name, logo, profile: p });

  const save = async () => {
    if (!name.trim()) return;
    setStatus('saving'); setError('');
    try {
      await update(restaurant.id, { name, logo, profile: { ...p, delivery } });
    } catch (e) { setError((e as Error).message); setStatus('idle'); return; }
    try { await saveRestaurantPrivate(restaurant.id, priv); } catch { setError(t('profile.privateError')); }
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 1500);
  };

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'logo' | 'cover') => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      if (kind === 'logo') setLogo(await fileToLogoDataUrl(f));
      else set('coverPhoto', await fileToLogoDataUrl(f, 1200, 0.8));
    } catch { setError(t('restaurants.logoError')); }
  };

  const copyReview = async () => {
    try { await navigator.clipboard.writeText(p.googleReviewUrl!.trim()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sem permissão */ }
  };

  const downloadQr = async () => {
    if (!qr) return;
    const blob = await (await fetch(qr)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = restaurant.name.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'restaurante';
    a.href = url; a.download = `${slug}-google-reviews-qr.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <RestaurantLogo restaurant={{ name, logo }} size={56} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-navy-900">{t('profile.title')}</h1>
          <p className="text-sm text-slate-500">{t('profile.subtitle')}</p>
        </div>
        <div className="w-full sm:w-48">
          <div className="flex justify-between text-xs text-slate-500 mb-1"><span>{t('profile.completion', { pct })}</span></div>
          <div className="h-2 bg-blue-100 rounded-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Identidade */}
      <Section id="identity" title={t('profile.sections.identity')} defaultOpen>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={`${t('profile.name')} *`} value={name} onChange={setName} />
          <Field label={t('profile.legalName')} value={p.legalName} onChange={v => set('legalName', v)} />
          <Field label={t('profile.unitName')} value={p.unitName} onChange={v => set('unitName', v)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className="label">{t('profile.logo')}</span>
            <div className="flex items-center gap-3">
              <RestaurantLogo restaurant={{ name: name || '?', logo }} size={72} />
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => logoRef.current?.click()} className="btn-secondary"><ImagePlus size={15} /> {logo ? t('restaurants.replaceLogo') : t('restaurants.uploadLogo')}</button>
                {logo && <button type="button" onClick={() => setLogo(null)} className="btn-secondary text-red-600"><Trash2 size={15} /> {t('restaurants.removeLogo')}</button>}
              </div>
              <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e => pickImage(e, 'logo')} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{t('profile.logoPrintHint')}</p>
          </div>
          <div>
            <span className="label">{t('profile.cover')}</span>
            {p.coverPhoto
              ? <img src={p.coverPhoto} alt="" className="w-full h-24 object-cover rounded-xl border border-blue-100 mb-2" />
              : <div className="w-full h-24 rounded-xl border border-dashed border-blue-200 bg-blue-50 mb-2" aria-hidden="true" />}
            <div className="flex gap-2">
              <button type="button" onClick={() => coverRef.current?.click()} className="btn-secondary"><ImagePlus size={15} /> {t('profile.cover')}</button>
              {p.coverPhoto && <button type="button" onClick={() => set('coverPhoto', null)} className="btn-secondary text-red-600" aria-label={t('profile.remove')}><Trash2 size={15} /></button>}
            </div>
            <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => pickImage(e, 'cover')} />
            <p className="text-xs text-slate-500 mt-1">{t('profile.coverHint')}</p>
          </div>
        </div>
        <Field label={t('profile.shortDescription')} value={p.shortDescription} onChange={v => set('shortDescription', v)} />
        <Field label={t('profile.description')} value={p.description} onChange={v => set('description', v)} multiline />
      </Section>

      {/* Tipo */}
      <Section id="type" title={t('profile.sections.type')}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('profile.establishmentType')}>
          {TYPES.map(ty => <Chip key={ty} active={p.establishmentType === ty} onClick={() => set('establishmentType', p.establishmentType === ty ? undefined : ty)}>{t(`profile.types.${ty}`)}</Chip>)}
        </div>
        {p.establishmentType === 'other' && <Field label={t('profile.customType')} value={p.establishmentTypeCustom} onChange={v => set('establishmentTypeCustom', v)} />}
      </Section>

      {/* Cozinha */}
      <Section id="cuisine" title={t('profile.sections.cuisine')}>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...CUISINES, ...(p.cuisines ?? [])])].map(c => (
            <Chip key={c} active={(p.cuisines ?? []).includes(c)} onClick={() => {
              const next = toggleIn(p.cuisines, c);
              setP(x => ({ ...x, cuisines: next, primaryCuisine: next.includes(x.primaryCuisine ?? '') ? x.primaryCuisine : next[0] }));
            }}>{cuisineLabel(c)}{p.primaryCuisine === c && ' ★'}</Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <input aria-label={t('profile.addCuisine')} value={newCuisine} onChange={e => setNewCuisine(e.target.value)} className="field" placeholder={t('profile.cuisinePlaceholder')} />
          <button type="button" className="btn-secondary shrink-0" onClick={() => {
            const c = newCuisine.trim(); if (!c) return;
            setP(x => ({ ...x, cuisines: [...new Set([...(x.cuisines ?? []), c])], primaryCuisine: x.primaryCuisine ?? c }));
            setNewCuisine('');
          }}><Plus size={15} /> {t('profile.addCuisine')}</button>
        </div>
        {(p.cuisines ?? []).length > 0 && (
          <div>
            <span className="label">{t('profile.primary')}</span>
            <div className="flex flex-wrap gap-2">
              {(p.cuisines ?? []).map(c => (
                <button key={c} type="button" onClick={() => set('primaryCuisine', c)} aria-pressed={p.primaryCuisine === c}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm border ${p.primaryCuisine === c ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <Star size={13} className={p.primaryCuisine === c ? 'fill-amber-400 text-amber-500' : ''} /> {cuisineLabel(c)}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Atendimento */}
      <Section id="service" title={t('profile.sections.service')}>
        <div>
          <span className="label">{t('profile.serviceModes')}</span>
          <div className="flex flex-wrap gap-2">
            {MODES.map(m => <Chip key={m} active={(p.serviceModes ?? []).includes(m)} onClick={() => set('serviceModes', toggleIn(p.serviceModes, m))}>{t(`profile.modes.${m}`)}</Chip>)}
          </div>
        </div>
        <div>
          <span className="label">{t('profile.segment')}</span>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map(s => <Chip key={s} active={p.serviceSegment === s} onClick={() => set('serviceSegment', s)}>{t(`profile.segments.${s}`)}</Chip>)}
          </div>
          <p className="text-xs text-slate-500 mt-1">{t('profile.segmentHint')}</p>
        </div>
      </Section>

      {/* Localização */}
      <Section id="location" title={t('profile.sections.location')}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field className="sm:col-span-2" label={t('profile.address')} value={p.address} onChange={v => set('address', v)} />
          <Field label={t('profile.address2')} value={p.address2} onChange={v => set('address2', v)} />
          <Field label={t('profile.city')} value={p.city} onChange={v => set('city', v)} />
          <Field label={t('profile.state')} value={p.state} onChange={v => set('state', v)} />
          <Field label={t('profile.zip')} value={p.zip} onChange={v => set('zip', v)} />
          <Field label={t('profile.country')} value={p.country} onChange={v => set('country', v)} />
          <div>
            <label className="label" htmlFor="tz">{t('profile.timezone')}</label>
            <input id="tz" list="tz-list" value={p.timezone ?? ''} onChange={e => set('timezone', e.target.value)} className="field" placeholder="America/New_York" />
            <datalist id="tz-list">
              {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Puerto_Rico', 'America/Santo_Domingo', 'America/Sao_Paulo', 'America/Bogota', 'America/Mexico_City'].map(z => <option key={z} value={z} />)}
            </datalist>
          </div>
        </div>
      </Section>

      {/* Horários */}
      <Section id="hours" title={t('profile.sections.hours')}>
        <ul className="space-y-2">
          {DAYS.map(d => {
            const h = hours(d);
            return (
              <li key={d} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-24 text-sm font-medium text-navy-900">{t(`profile.days.${d}`)}</span>
                <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={h.closed} onChange={e => setHours(d, { ...h, closed: e.target.checked })} className="accent-blue-600 w-4 h-4" /> {t('profile.closed')}
                </label>
                {!h.closed && h.shifts.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <input type="time" aria-label={`${t(`profile.days.${d}`)} ${t('profile.open')}`} value={s.open} onChange={e => setHours(d, { ...h, shifts: h.shifts.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)) })} className="field !w-28 !py-1" />
                    –
                    <input type="time" aria-label={`${t(`profile.days.${d}`)} ${t('profile.close')}`} value={s.close} onChange={e => setHours(d, { ...h, shifts: h.shifts.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)) })} className="field !w-28 !py-1" />
                    <button type="button" onClick={() => setHours(d, { ...h, shifts: h.shifts.filter((_, j) => j !== i) })} className="btn-ghost" aria-label={t('profile.remove')}><Trash2 size={14} /></button>
                  </span>
                ))}
                {!h.closed && (
                  <button type="button" onClick={() => setHours(d, { ...h, shifts: [...h.shifts, { open: '11:00', close: '15:00' }] })} className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"><Plus size={12} /> {t('profile.addShift')}</button>
                )}
              </li>
            );
          })}
        </ul>
        {(p.establishmentType === 'foodtruck' || (p.truckLocations ?? []).length > 0) && (
          <div className="pt-2">
            <h3 className="font-semibold text-navy-900 text-sm">{t('profile.truckLocations')}</h3>
            <p className="text-xs text-slate-500 mb-2">{t('profile.truckHint')}</p>
            {(p.truckLocations ?? []).map(loc => (
              <div key={loc.id} className="rounded-xl border border-blue-100 p-3 mb-2 space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <input aria-label={t('profile.locationName')} placeholder={t('profile.locationName')} value={loc.name} onChange={e => set('truckLocations', (p.truckLocations ?? []).map(x => (x.id === loc.id ? { ...x, name: e.target.value } : x)))} className="field" />
                  <input aria-label={t('profile.locationAddress')} placeholder={t('profile.locationAddress')} value={loc.address} onChange={e => set('truckLocations', (p.truckLocations ?? []).map(x => (x.id === loc.id ? { ...x, address: e.target.value } : x)))} className="field" />
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {DAYS.map(d => <Chip key={d} active={loc.days.includes(d)} onClick={() => set('truckLocations', (p.truckLocations ?? []).map(x => (x.id === loc.id ? { ...x, days: toggleIn(x.days, d) } : x)))}>{t(`profile.days.${d}`).slice(0, 3)}</Chip>)}
                  <button type="button" onClick={() => set('truckLocations', (p.truckLocations ?? []).filter(x => x.id !== loc.id))} className="btn-ghost ml-auto" aria-label={t('profile.remove')}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => set('truckLocations', [...(p.truckLocations ?? []), { id: uuidv4(), name: '', address: '', days: [] }])} className="btn-secondary"><Plus size={15} /> {t('profile.addLocation')}</button>
          </div>
        )}
      </Section>

      {/* Contato */}
      <Section id="contact" title={t('profile.sections.contact')}>
        <h3 className="text-sm font-semibold text-navy-900">{t('profile.publicContact')}</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label={t('profile.businessPhone')} type="tel" value={p.businessPhone} onChange={v => set('businessPhone', v)} />
          <Field label={t('profile.businessEmail')} type="email" value={p.businessEmail} onChange={v => set('businessEmail', v)} />
          <Field label={t('profile.whatsapp')} type="tel" value={p.whatsapp} onChange={v => set('whatsapp', v)} />
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-1.5"><Lock size={14} /> {t('profile.privateTitle')}</h3>
          <p className="text-xs text-slate-500">{t('profile.privateHint')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t('profile.ownerName')} value={priv.ownerName} onChange={v => setPriv(x => ({ ...x, ownerName: v }))} />
            <Field label={t('profile.managerName')} value={priv.managerName} onChange={v => setPriv(x => ({ ...x, managerName: v }))} />
            <Field label={t('profile.privatePhone')} type="tel" value={priv.privatePhone} onChange={v => setPriv(x => ({ ...x, privatePhone: v }))} />
            <Field label={t('profile.privateEmail')} type="email" value={priv.privateEmail} onChange={v => setPriv(x => ({ ...x, privateEmail: v }))} />
          </div>
          <Field label={t('profile.consultingNotes')} value={priv.consultingNotes} onChange={v => setPriv(x => ({ ...x, consultingNotes: v }))} multiline />
        </div>
      </Section>

      {/* Presença digital */}
      <Section id="digital" title={t('profile.sections.digital')}>
        <div className="grid sm:grid-cols-2 gap-4">
          {(['website', 'menuUrl', 'directOrdersUrl', 'reservationsUrl', 'instagram', 'facebook', 'tiktok'] as const).map(k => (
            <Field key={k} label={t(`profile.${k}`)} type="url" value={p[k]} onChange={v => set(k, v)} placeholder="https://" />
          ))}
        </div>
        <div>
          <span className="label">{t('profile.otherLinks')}</span>
          {(p.otherLinks ?? []).map(l => (
            <div key={l.id} className="flex gap-2 mb-2">
              <input aria-label={t('profile.linkLabel')} placeholder={t('profile.linkLabel')} value={l.label} onChange={e => set('otherLinks', (p.otherLinks ?? []).map(x => (x.id === l.id ? { ...x, label: e.target.value } : x)))} className="field !w-40" />
              <input aria-label={t('profile.linkUrl')} placeholder="https://" type="url" value={l.url} onChange={e => set('otherLinks', (p.otherLinks ?? []).map(x => (x.id === l.id ? { ...x, url: e.target.value } : x)))} className="field" />
              <button type="button" onClick={() => set('otherLinks', (p.otherLinks ?? []).filter(x => x.id !== l.id))} className="btn-ghost" aria-label={t('profile.remove')}><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => set('otherLinks', [...(p.otherLinks ?? []), { id: uuidv4(), label: '', url: '' }])} className="btn-secondary"><Plus size={15} /> {t('profile.addLink')}</button>
        </div>
      </Section>

      {/* Google */}
      <Section id="google" title={t('profile.sections.google')}>
        <div className="flex gap-2 items-end">
          <Field className="flex-1" label={t('profile.googleMaps')} type="url" value={p.googleMapsUrl} onChange={v => set('googleMapsUrl', v)} placeholder="https://maps.google.com/..." />
          <a href={isUrl(p.googleMapsUrl) ? p.googleMapsUrl : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!isUrl(p.googleMapsUrl)}
            className={`btn-secondary shrink-0 ${isUrl(p.googleMapsUrl) ? '' : 'pointer-events-none opacity-40'}`}><ExternalLink size={15} /> {t('profile.openProfile')}</a>
        </div>
        <div>
          <Field label={t('profile.googleReview')} type="url" value={p.googleReviewUrl} onChange={v => set('googleReviewUrl', v)} placeholder="https://g.page/r/..." />
          <p className="text-xs text-slate-600 mt-1">
            {t('profile.reviewHelp')}{' '}
            <a href={REVIEW_HELP_URL} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{t('profile.reviewSource')}</a>
          </p>
          {p.googleReviewUrl && !isUrl(p.googleReviewUrl) && <p className="text-xs text-red-600 mt-1">{t('profile.invalidUrl')}</p>}
        </div>
        {isUrl(p.googleReviewUrl) && (
          <div className="flex flex-col sm:flex-row gap-4 items-start rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            {qr && <img src={qr} alt="QR code" className="w-36 h-36 rounded-lg bg-white border border-blue-100" />}
            <div className="space-y-2 min-w-0">
              <p className="text-xs text-slate-500 break-all">{p.googleReviewUrl}</p>
              <p className="text-xs text-slate-600">{t('profile.qrHint')}</p>
              <div className="flex flex-wrap gap-2">
                <a href={p.googleReviewUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary"><ExternalLink size={15} /> {t('profile.openReview')}</a>
                <button type="button" onClick={copyReview} className="btn-secondary">{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t('profile.copied') : t('profile.copyLink')}</button>
                <button type="button" onClick={downloadQr} disabled={!qr} className="btn-primary"><Download size={15} /> {t('profile.downloadQr')}</button>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Delivery */}
      <Section id="delivery" title={t('profile.sections.delivery')}>
        <p className="text-xs text-slate-500">{t('profile.deliveryHint')}</p>
        {delivery.map(ch => {
          const upd = (patch: Partial<typeof ch>) => set('delivery', delivery.map(x => (x.id === ch.id ? { ...x, ...patch } : x)));
          const custom = !['doordash', 'ubereats', 'grubhub', 'own'].includes(ch.id);
          return (
            <div key={ch.id} className="rounded-xl border border-blue-100 p-3 grid sm:grid-cols-[10rem_1fr_8rem_auto] gap-2 items-center">
              {custom
                ? <input aria-label={t('profile.platformName')} placeholder={t('profile.platformName')} value={ch.name} onChange={e => upd({ name: e.target.value })} className="field" />
                : <span className="font-semibold text-navy-900">{channelName(ch.id, ch.name)}</span>}
              <input aria-label={`${channelName(ch.id, ch.name)} — ${t('profile.channelUrl')}`} type="url" placeholder={t('profile.channelUrl')} value={ch.url} onChange={e => upd({ url: e.target.value })} className="field" />
              <input aria-label={`${channelName(ch.id, ch.name)} — ${t('profile.feePct')}`} type="number" min="0" max="100" step="0.1" placeholder={t('profile.feePct')} value={ch.feePct ?? ''} onChange={e => upd({ feePct: numOrNull(e.target.value) })} className="field" />
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" aria-label={`${channelName(ch.id, ch.name) || t('profile.platformName')} — ${t('profile.channelActive')}`} checked={ch.active} onChange={e => upd({ active: e.target.checked })} className="accent-blue-600 w-4 h-4" /> {t('profile.channelActive')}</label>
                {custom && <button type="button" onClick={() => set('delivery', delivery.filter(x => x.id !== ch.id))} className="btn-ghost" aria-label={t('profile.remove')}><Trash2 size={15} /></button>}
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => set('delivery', [...delivery, { id: uuidv4(), name: '', active: true, url: '', feePct: null }])} className="btn-secondary"><Plus size={15} /> {t('profile.addPlatform')}</button>
      </Section>

      {/* Planejamento */}
      <Section id="planning" title={t('profile.sections.planning')}>
        <p className="text-xs text-slate-500">{t('profile.planningHint')}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('profile.openDays')} type="number" value={p.openDaysPerMonth} onChange={v => set('openDaysPerMonth', numOrNull(v))} />
          <Field label={t('profile.avgTicket')} type="number" value={p.avgTicket} onChange={v => set('avgTicket', numOrNull(v))} />
        </div>
        <div>
          <span className="label">{t('profile.ticketByChannel')}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[...BASE_CHANNELS.map(id => ({ id, name: '' })), ...delivery.filter(d => d.active)].map(c => (
              <div key={c.id}>
                <label className="text-[11px] text-slate-500" htmlFor={`tk-${c.id}`}>{channelName(c.id, c.name)}</label>
                <input id={`tk-${c.id}`} type="number" min="0" step="0.01" value={p.ticketByChannel?.[c.id] ?? ''} onChange={e => set('ticketByChannel', { ...(p.ticketByChannel ?? {}), [c.id]: numOrNull(e.target.value) })} className="field !py-1.5" />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <div className="sticky bottom-20 lg:bottom-4 z-30 flex items-center gap-3 justify-end">
        {error && <p className="text-sm text-red-600 bg-white rounded-lg px-3 py-1 shadow" role="alert">{error}</p>}
        <button onClick={save} disabled={!name.trim() || status === 'saving'} className="btn-primary shadow-lg !px-6 !py-2.5">
          {status === 'saved' ? <Check size={16} /> : <Save size={16} />}
          {status === 'saving' ? t('profile.saving') : status === 'saved' ? t('profile.saved') : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
