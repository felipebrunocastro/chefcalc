import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Copy, Check, Eraser, Search, Star, History as HistoryIcon } from 'lucide-react';
import { UNITS_BY_CATEGORY, WEIGHT_UNITS, VOLUME_UNITS, type Category } from '../../lib/conversion/unitDefinitions';
import { SYSTEMS, type MeasurementSystem } from '../../lib/conversion/measurementSystems';
import { DENSITY_DB, findDensity } from '../../lib/conversion/ingredientDensityDatabase';
import { convert, formatResult } from '../../lib/conversion/conversionEngine';
import { EQUIVALENCES, HISTORY_KEY, FAVORITES_KEY, MAX_HISTORY } from '../../lib/conversion/conversionConstants';
import type { Lang } from '../../types';

type Tab = Category | 'ingredient';
const TABS: Tab[] = ['weight', 'volume', 'ingredient', 'length', 'temperature'];

interface HistoryEntry {
  value: string; from: string; to: string; output: string; system: MeasurementSystem;
  tab: Tab; ingredient?: string;
}

function loadJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}

const DEFAULTS: Record<Tab, { from: string; to: string }> = {
  weight: { from: 'g', to: 'oz' },
  volume: { from: 'ml', to: 'cup' },
  ingredient: { from: 'g', to: 'cup' },
  length: { from: 'cm', to: 'in' },
  temperature: { from: 'C', to: 'F' },
};

export function ConverterPanel({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;

  const [tab, setTab] = useState<Tab>('weight');
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState(DEFAULTS.weight.from);
  const [to, setTo] = useState(DEFAULTS.weight.to);
  const [system, setSystem] = useState<MeasurementSystem>('metric');
  const [ingredientId, setIngredientId] = useState(DENSITY_DB[0].id);
  const [ingSearch, setIngSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadJSON(HISTORY_KEY, []));
  const [favorites, setFavorites] = useState<string[]>(() => loadJSON(FAVORITES_KEY, []));

  // Unidades disponíveis por aba (ingrediente = peso + volume).
  const unitOptions = useMemo(() => {
    if (tab === 'ingredient') return [...WEIGHT_UNITS, ...VOLUME_UNITS];
    return UNITS_BY_CATEGORY[tab];
  }, [tab]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setFrom(DEFAULTS[next].from);
    setTo(DEFAULTS[next].to);
  };

  const showSystem = tab === 'volume' || tab === 'ingredient';

  const density = tab === 'ingredient' ? findDensity(ingredientId)?.density : undefined;

  const numeric = parseFloat(value.replace(',', '.'));
  const result = useMemo(
    () => convert({ value: numeric, from, to, system, density }),
    [numeric, from, to, system, density]
  );
  const resultText = formatResult(result);

  const swap = () => { setFrom(to); setTo(from); };

  const clear = () => { setValue(''); };

  const copy = useCallback(async () => {
    if (!Number.isFinite(result)) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [result, resultText]);

  // Salva última conversão + histórico automaticamente quando há resultado válido.
  useEffect(() => {
    if (!Number.isFinite(result) || !value) return;
    const entry: HistoryEntry = { value, from, to, output: resultText, system, tab, ingredient: tab === 'ingredient' ? ingredientId : undefined };
    const id = setTimeout(() => {
      setHistory(prev => {
        const next = [entry, ...prev.filter(h => !(h.value === entry.value && h.from === entry.from && h.to === entry.to && h.tab === entry.tab && h.ingredient === entry.ingredient))].slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    }, 900);
    return () => clearTimeout(id);
  }, [result, value, from, to, system, tab, ingredientId, resultText]);

  const restore = (h: HistoryEntry) => {
    setTab(h.tab); setValue(h.value); setFrom(h.from); setTo(h.to); setSystem(h.system);
    if (h.ingredient) setIngredientId(h.ingredient);
  };

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const ingredientList = useMemo(() => {
    const q = ingSearch.toLowerCase();
    const matches = DENSITY_DB.filter(d => (d.nome[lang] || d.nome.pt).toLowerCase().includes(q));
    return [...matches].sort((a, b) => {
      const fa = favorites.includes(a.id) ? 0 : 1;
      const fb = favorites.includes(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (a.nome[lang] || a.nome.pt).localeCompare(b.nome[lang] || b.nome.pt);
    });
  }, [ingSearch, favorites, lang]);

  const unitLabel = (id: string) => t(`converter.units.${id}`);

  return (
    <div className={compact ? '' : 'max-w-2xl mx-auto'}>
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map(tb => (
          <button
            key={tb}
            onClick={() => changeTab(tb)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === tb ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(`converter.categories.${tb}`)}
          </button>
        ))}
      </div>

      {/* Ingredient picker */}
      {tab === 'ingredient' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
            <input
              value={ingSearch}
              onChange={e => setIngSearch(e.target.value)}
              placeholder={t('converter.searchIngredient')}
              className="w-full pl-9 pr-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="max-h-36 overflow-y-auto scrollbar-thin flex flex-wrap gap-1.5">
            {ingredientList.map(d => (
              <button
                key={d.id}
                onClick={() => setIngredientId(d.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  ingredientId === d.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Star
                  size={11}
                  onClick={e => { e.stopPropagation(); toggleFav(d.id); }}
                  className={favorites.includes(d.id) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                />
                {d.nome[lang] || d.nome.pt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* System selector */}
      {showSystem && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium text-gray-500">{t('converter.system')}:</span>
          <div className="flex gap-1">
            {SYSTEMS.map(s => (
              <button
                key={s.id}
                onClick={() => setSystem(s.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  system === s.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(`converter.systems.${s.id}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversion row */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          {/* From */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('converter.from')}</label>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
            />
            <select
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {unitOptions.map(u => <option key={u.id} value={u.id}>{unitLabel(u.id)}</option>)}
            </select>
          </div>

          {/* Swap */}
          <button
            onClick={swap}
            title={t('converter.swap')}
            className="mx-auto md:mb-2 p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
          >
            <ArrowLeftRight size={18} />
          </button>

          {/* To */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('converter.to')}</label>
            <div className="w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-lg font-mono font-bold text-amber-700 mb-2 truncate">
              {resultText}
            </div>
            <select
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {unitOptions.map(u => <option key={u.id} value={u.id}>{unitLabel(u.id)}</option>)}
            </select>
          </div>
        </div>

        {/* Result line + actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600 font-mono truncate">
            {value || 0} {unitLabel(from)} = <strong className="text-gray-900">{resultText} {unitLabel(to)}</strong>
          </p>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-700 hover:bg-gray-200">
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              {copied ? t('converter.copied') : t('converter.copy')}
            </button>
            <button onClick={clear} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-700 hover:bg-gray-200">
              <Eraser size={13} /> {t('converter.clear')}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <HistoryIcon size={13} /> {t('converter.history')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => restore(h)}
                className="px-2.5 py-1 rounded-md text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 font-mono"
              >
                {h.value} {unitLabel(h.from)} → {h.output} {unitLabel(h.to)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Equivalences */}
      {!compact && (
        <div className="mt-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('converter.equivalences')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EQUIVALENCES.map(eq => (
              <div key={eq} className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600 font-mono text-center">
                {eq}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
