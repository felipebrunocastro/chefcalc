import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Copy, Check, Mail, RotateCw, Trash2, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurant } from '../../hooks/useRestaurant';
import { getTeam, inviteMember, removeMember, type TeamMember } from '../../data/posRepo';
import { Modal } from '../pos/Modal';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Perfil do restaurante → Equipe e acessos.
export function TeamSection() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { current } = useRestaurant();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [form, setForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMember['role']>('operator');
  const [unit, setUnit] = useState('');
  const [step, setStep] = useState<'form' | 'review' | 'link'>('form');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<TeamMember | null>(null);
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  const load = useCallback(async () => { if (current) setTeam(await getTeam(current.id).catch(() => [])); }, [current]);
  useEffect(() => { load(); }, [load]);
  if (!current) return null;
  const units = [...new Set([...(current.profile.pos?.units ?? []), current.profile.unitName ?? ''].filter(Boolean))];

  const reset = () => { setForm(false); setStep('form'); setEmail(''); setUnit(''); setRole('operator'); setLink(''); setError(''); };
  const review = () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setError(t('team.invalidEmail'));
    if (e === (user?.email ?? '').toLowerCase()) return setError(t('team.selfEmail'));
    setError(''); setStep('review');
  };
  const send = async (m?: TeamMember) => {
    try {
      const l = await inviteMember(current.id, m?.email ?? email, m?.role ?? role, m ? m.unit : unit || null);
      setLink(l); setStep('link'); setForm(true);
      if (m) { setEmail(m.email); setRole(m.role); setUnit(m.unit ?? ''); }
      await load();
    } catch (e) { setError((e as Error).message); }
  };
  const mailto = () => {
    const vars = { name: current.name, role: t(`team.roles.${role}`), email, link };
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(t('team.mailSubject', vars))}&body=${encodeURIComponent(t('team.mailBody', vars))}`;
  };
  const perms = t(`team.perms.${role}`, { returnObjects: true }) as string[];

  return (
    <section id="profile-team" className="card p-4 md:p-5 space-y-3" aria-labelledby="team-h">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck size={18} className="text-blue-600" aria-hidden="true" />
        <h2 id="team-h" className="font-semibold text-navy-900">{t('team.title')}</h2>
        <button onClick={() => { reset(); setForm(true); }} className="btn-primary ml-auto"><UserPlus size={16} /> {t('team.add')}</button>
      </div>
      <p className="text-xs text-slate-500">{t('team.hint')}</p>
      {team.length === 0 ? <p className="text-sm text-slate-400">{t('team.none')}</p> : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {team.map(m => {
            const expired = m.status === 'pending' && m.expiresAt && new Date(m.expiresAt) < new Date();
            return (
              <li key={m.email} className="px-3 py-2.5 flex flex-wrap items-center gap-2" data-testid={`team-${m.email}`}>
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-medium text-navy-900">{m.email}</div>
                  <div className="text-xs text-slate-500">{t(`team.roles.${m.role}`)}{m.unit ? ` · ${m.unit}` : ''}</div>
                </div>
                {m.status === 'pending'
                  ? <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-900 inline-flex items-center gap-1"><Clock size={12} /> {t('team.pending')} · {expired ? t('team.expired') : t('team.expires', { date: m.expiresAt ? new Date(m.expiresAt).toLocaleDateString(locale) : '—' })}</span>
                  : <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-900">{t('team.active')}</span>}
                {m.status === 'pending' && <button onClick={() => send(m)} className="btn-secondary !py-1.5 text-xs"><RotateCw size={13} /> {t('team.resend')}</button>}
                <button onClick={() => (m.status === 'pending' ? removeMember(current.id, m.email).then(load) : setRevoking(m))} className="btn-secondary !py-1.5 text-xs text-red-700">
                  <Trash2 size={13} /> {m.status === 'pending' ? t('team.cancelInvite') : t('team.revoke')}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <Modal title={t('team.add')} onClose={reset} footer={
          step === 'form' ? <button onClick={review} className="btn-primary !py-3 !px-6">{t('team.review')}</button>
            : step === 'review' ? <><button onClick={() => setStep('form')} className="btn-secondary !py-3">{t('pos.back')}</button><button onClick={() => send()} className="btn-primary !py-3 !px-6">{t('team.send')}</button></>
              : <button onClick={reset} className="btn-primary !py-3 !px-6">{t('pos.closeDialog')}</button>
        }>
          {step === 'form' && <>
            <div><label htmlFor="tm-email" className="label">{t('team.email')}</label><input id="tm-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="field !py-3 text-base" placeholder="nome@email.com" /></div>
            <div><label htmlFor="tm-role" className="label">{t('team.role')}</label>
              <select id="tm-role" value={role} onChange={e => setRole(e.target.value as TeamMember['role'])} className="field !py-3 text-base">
                {(['operator', 'finance', 'viewer'] as const).map(r => <option key={r} value={r}>{t(`team.roles.${r}`)}</option>)}
              </select></div>
            {role === 'operator' && units.length > 0 && (
              <div><label htmlFor="tm-unit" className="label">{t('team.unit')}</label>
                <select id="tm-unit" value={unit} onChange={e => setUnit(e.target.value)} className="field !py-3 text-base"><option value="">{t('team.allUnits')}</option>{units.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            )}
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </>}
          {step === 'review' && (
            <div className="space-y-2 text-sm" data-testid="invite-review">
              <p><span className="text-slate-500">{t('team.restaurant')}:</span> <b>{current.name}</b></p>
              <p><span className="text-slate-500">{t('team.unit')}:</span> <b>{unit || t('team.allUnits')}</b></p>
              <p><span className="text-slate-500">{t('team.email')}:</span> <b>{email.trim().toLowerCase()}</b></p>
              <p><span className="text-slate-500">{t('team.role')}:</span> <b>{t(`team.roles.${role}`)}</b></p>
              <ul className="list-disc ml-5 text-slate-700">{perms.map(p => <li key={p}>{p}</li>)}</ul>
              <p className="text-xs text-slate-500">{t('team.ownerKeeps')}</p>
            </div>
          )}
          {step === 'link' && (
            <div className="space-y-3">
              <label htmlFor="tm-link" className="label">{t('team.link')}</label>
              <input id="tm-link" readOnly value={link} className="field font-mono text-xs" onFocus={e => e.currentTarget.select()} data-testid="invite-link" />
              <div className="flex flex-wrap gap-2">
                <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sem permissão */ } }} className="btn-secondary">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t('team.copied') : t('team.copy')}</button>
                <a href={mailto()} className="btn-secondary"><Mail size={16} /> {t('team.byEmail')}</a>
              </div>
              <p className="text-xs text-slate-600">{t('team.linkHint')}</p>
            </div>
          )}
        </Modal>
      )}
      {revoking && (
        <Modal title={t('team.revoke')} onClose={() => setRevoking(null)} footer={<button onClick={async () => { await removeMember(current.id, revoking.email); setRevoking(null); load(); }} className="btn-primary !py-3 !px-6 !bg-red-600 hover:!bg-red-700">{t('team.revoke')}</button>}>
          <p>{t('team.confirmRevoke', { email: revoking.email })}</p>
        </Modal>
      )}
    </section>
  );
}
