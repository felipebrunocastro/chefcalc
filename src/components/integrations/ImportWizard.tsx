import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { analyze, diffExisting, isBlocked, parseCsv, sha256, type Analysis, type DateOrder, type Mapping, type SalesRecord } from '../../lib/imports/normalize';
import { FIELDS, PRESETS, type CanonicalField } from '../../lib/imports/presets';
import { formatCurrency } from '../../lib/currency';
import type { ImportBatch } from '../../data/importsRepo';

export interface WizardResult { records: SalesRecord[]; batch: Omit<ImportBatch, 'id' | 'createdAt' | 'updatedAt'>; existingBatchId?: string; diff: { inserted: number; updated: number; unchanged: number } }

interface Props {
  initialSource: string;                         // 'doordash' | 'ubereats' | 'grubhub' | 'generic'
  channels: { id: string; label: string }[];
  units: string[];
  existing: SalesRecord[];
  batches: ImportBatch[];
  savedMapping: (source: string) => Promise<Record<string, unknown> | null>;
  onConfirm: (r: WizardResult) => Promise<void>;
  onClose: () => void;
}

const slug = (s: string) => s.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();

export function ImportWizard({ initialSource, channels, units, existing, batches, savedMapping, onConfirm, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [preset, setPreset] = useState(initialSource);
  const [platformName, setPlatformName] = useState('');
  const [channel, setChannel] = useState(PRESETS[initialSource]?.channel || 'direct');
  const [file, setFile] = useState<{ name: string; text: string; hash: string } | null>(null);
  const [mapping, setMapping] = useState<Mapping | undefined>();
  const [dateOrder, setDateOrder] = useState<DateOrder | undefined>();
  const [unit, setUnit] = useState(units[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const source = preset === 'generic' ? `generic:${slug(platformName) || 'outro'}` : preset;
  useEffect(() => { if (preset !== 'generic') setChannel(PRESETS[preset].channel); }, [preset]);
  useEffect(() => {
    let alive = true;
    savedMapping(source).then(m => { if (alive && m && Object.keys(m).length) setMapping(m as Mapping); });
    return () => { alive = false; };
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  const table = useMemo(() => (file ? parseCsv(file.text) : null), [file]);
  const a: Analysis | null = useMemo(() => (table ? analyze(table, { source, channel, unit, mapping, dateOrder }) : null), [table, source, channel, unit, mapping, dateOrder]);
  const existingMap = useMemo(() => new Map(existing.filter(r => r.source === source).map(r => [r.recordKey, r] as const)), [existing, source]);
  const diff = a ? diffExisting(a.records, existingMap) : null;
  const prior = file ? batches.find(b => b.source === source && b.fileHash === file.hash) : undefined;
  const blocked = !a || isBlocked(a) || (preset === 'generic' && !platformName.trim());
  // Abre o mapeamento quando há problema e não fecha sozinho enquanto o usuário corrige.
  useEffect(() => { if (a && isBlocked(a)) setMapOpen(true); }, [a]);
  const fieldLabel = (f: CanonicalField) => t(`integ.fields.${f}`);
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(locale) : '—');

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const text = await f.text();
    setFile({ name: f.name, text, hash: await sha256(text) });
  };

  const confirm = async () => {
    if (!a || !file || blocked) return;
    setBusy(true); setError('');
    try {
      const recs = a.records.map(r => ({ ...r, unit: r.unit || unit }));
      await onConfirm({
        records: recs, existingBatchId: prior?.id, diff: diff!,
        batch: {
          source, channel, unit: a.units.length === 1 ? a.units[0] : (a.units.length ? '' : unit), fileName: file.name, fileHash: file.hash,
          periodStart: a.period.start, periodEnd: a.period.end, rowCount: a.records.length, inserted: diff!.inserted, updated: diff!.updated,
          summary: { totals: a.totals, counts: a.counts, units: a.units, platformName: platformName || PRESETS[preset]?.name },
          mapping: a.mapping as Record<string, unknown>,
        },
      });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  const issueText = (i: Analysis['issues'][number]) => t(`integ.issue.${i.code}`, { field: i.field ? fieldLabel(i.field) : '', columns: (i.columns ?? []).join(', '), count: i.count });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="iw-title">
      <div className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[94svh] overflow-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center gap-2 px-5 py-4 border-b border-blue-100">
          <h2 id="iw-title" className="text-lg font-bold text-navy-900">{t('integ.wizardTitle')}</h2>
          <button onClick={onClose} className="btn-ghost ml-auto" aria-label={t('integ.cancel')}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* 1. Fonte e arquivo */}
          <section className="space-y-3">
            <h3 className="font-semibold text-navy-900 text-sm">{t('integ.step1')}</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="iw-src">{t('integ.source')}</label>
                <select id="iw-src" value={preset} onChange={e => { setPreset(e.target.value); setMapping(undefined); }} className="field">
                  <option value="doordash">DoorDash</option>
                  <option value="ubereats">Uber Eats</option>
                  <option value="grubhub">Grubhub</option>
                  <option value="generic">{t('integ.genericCsv')}</option>
                </select>
              </div>
              {preset === 'generic' && (
                <>
                  <div>
                    <label className="label" htmlFor="iw-pn">{t('integ.platformName')} *</label>
                    <input id="iw-pn" value={platformName} onChange={e => setPlatformName(e.target.value)} className="field" placeholder="ex.: Toast, Clover, iFood" />
                  </div>
                  <div>
                    <label className="label" htmlFor="iw-ch">{t('integ.channel')}</label>
                    <select id="iw-ch" value={channel} onChange={e => setChannel(e.target.value)} className="field">
                      {channels.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => fileRef.current?.click()} className="btn-primary"><Upload size={15} /> {t('integ.chooseFile')}</button>
              {file && <span className="text-sm text-slate-600 truncate">{file.name}</span>}
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={pick} aria-label={t('integ.file')} />
            </div>
          </section>

          {a && (
            <section className="space-y-4">
              <h3 className="font-semibold text-navy-900 text-sm">{t('integ.step2')}</h3>
              {prior && (
                <p className="flex gap-2 text-sm rounded-lg bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2" role="status">
                  <Info size={16} className="shrink-0 mt-0.5" /> {t('integ.alreadyImported', { date: new Date(prior.updatedAt).toLocaleString(locale) })}
                </p>
              )}

              {/* Prévia: unidade, período e totais */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-blue-50 p-3">
                  <div className="text-xs text-slate-500">{t('integ.unit')}</div>
                  {a.units.length ? (
                    <div className="font-semibold text-navy-900">{a.units.join(', ')}</div>
                  ) : (
                    <>
                      <label className="text-xs text-amber-800" htmlFor="iw-unit">{t('integ.noUnitColumn')}</label>
                      <input id="iw-unit" list="iw-units" value={unit} onChange={e => setUnit(e.target.value)} className="field !py-1 mt-1" placeholder={t('integ.newUnit')} />
                      <datalist id="iw-units">{units.map(u => <option key={u} value={u} />)}</datalist>
                    </>
                  )}
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <div className="text-xs text-slate-500">{t('integ.period')}</div>
                  <div className="font-semibold text-navy-900">{fmtDate(a.period.start)} – {fmtDate(a.period.end)}</div>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <div className="text-xs text-slate-500">{t('integ.rows')}</div>
                  <div className="font-semibold text-navy-900">{a.records.length}</div>
                  <div className="text-[11px] text-slate-500">{t('integ.counts', a.counts)}</div>
                </div>
              </div>

              <div>
                <h4 className="label">{t('integ.totals')}</h4>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm" data-testid="iw-totals">
                  {(['netSales', 'commissions', 'promotions', 'otherFees', 'taxes', 'tips', 'adjustments', 'payout'] as const).map(k => (
                    <div key={k} className={`rounded-lg px-3 py-2 ${k === 'netSales' ? 'bg-navy-900 text-white' : 'bg-slate-50'}`}>
                      <dt className={`text-[11px] ${k === 'netSales' ? 'text-blue-200' : 'text-slate-500'}`}>{t(`integ.totalsLabels.${k}`)}</dt>
                      <dd className="font-mono font-semibold">{formatCurrency(a.totals[k])}</dd>
                    </div>
                  ))}
                </dl>
                {diff && <p className="text-xs text-slate-600 mt-2">{t('integ.diff', diff)}</p>}
              </div>

              {a.issues.length > 0 && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${isBlocked(a) ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`} role="status">
                  <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={15} /> {t('integ.issues')}</p>
                  <ul className="list-disc ml-5 text-xs mt-1 space-y-0.5">
                    {a.issues.map((i, k) => <li key={k} className={i.blocking ? 'font-semibold' : ''}>{issueText(i)}</li>)}
                  </ul>
                  {isBlocked(a) && <p className="text-xs mt-1">{t('integ.blocked')}</p>}
                </div>
              )}

              {/* Mapeamento */}
              <details open={mapOpen} onToggle={e => setMapOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-xl border border-blue-100">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy-900">{t('integ.mapping')}</summary>
                <div className="p-3 grid sm:grid-cols-2 gap-x-4 gap-y-2">
                  {FIELDS.map(f => {
                    const flagged = a.issues.some(i => i.field === f && (i.code === 'ambiguous' || i.blocking));
                    return (
                      <div key={f} className="flex items-center gap-2">
                        <label htmlFor={`map-${f}`} className={`text-xs w-44 shrink-0 ${flagged ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>{fieldLabel(f)}</label>
                        <select id={`map-${f}`} value={a.mapping[f] ?? ''} onChange={e => setMapping({ ...(mapping ?? a.mapping), [f]: e.target.value === '' ? null : Number(e.target.value) })}
                          className={`field !py-1 text-xs ${flagged ? '!border-red-400' : ''}`}>
                          <option value="">{t('integ.none')}</option>
                          {a.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2">
                    <label htmlFor="map-date" className="text-xs w-44 shrink-0 text-slate-600">{t('integ.dateOrder')}</label>
                    <select id="map-date" value={a.dateOrder} onChange={e => setDateOrder(e.target.value as DateOrder)} className="field !py-1 text-xs">
                      <option value="mdy">MM/DD/AAAA</option><option value="dmy">DD/MM/AAAA</option><option value="ymd">AAAA-MM-DD</option>
                    </select>
                  </div>
                </div>
              </details>

              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            </section>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-blue-100 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">{t('integ.cancel')}</button>
          <button onClick={confirm} disabled={blocked || busy} className="btn-primary">
            <CheckCircle2 size={15} /> {busy ? t('integ.importing') : t('integ.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
