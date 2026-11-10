import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Printer, Download, Upload, ClipboardList, ChefHat, FileDown } from 'lucide-react';
import { useDishes } from '../../hooks/useDishes';
import { useIngredients } from '../../hooks/useIngredients';
import { useRestaurant } from '../../hooks/useRestaurant';
import { calcItemCost } from '../../utils/calculations';
import { exportBackup, importBackup } from '../../db';
import { PrintableSheet, type PrintMode } from './PrintableSheet';
import type { Lang, Dish, Ingredient } from '../../types';

function buildCSV(dishes: Dish[], ingredients: Ingredient[], lang: Lang): string {
  const ingMap = new Map(ingredients.map(i => [i.id, i]));
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows: string[] = [];
  for (const dish of dishes) {
    rows.push(q(dish.nome[lang] || dish.nome.pt));
    rows.push('Ingrediente,Quantidade,Unidade,Custo');
    for (const item of dish.itens) {
      const ing = ingMap.get(item.ingredienteId);
      if (!ing) continue;
      rows.push(`${q(ing.nome[lang] || ing.nome.pt)},${item.quantidadeUsada},${item.unidade},${calcItemCost(ing, item.quantidadeUsada, item.unidade).toFixed(2)}`);
    }
    rows.push('');
  }
  return rows.join('\n');
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function ExportPage({ initialSelection }: { initialSelection?: string[] }) {
  const { t, i18n } = useTranslation();
  const { current: restaurant } = useRestaurant();
  const { dishes } = useDishes();
  const { ingredients } = useIngredients();
  const lang = i18n.language as Lang;
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelection ?? []));
  const [mode, setMode] = useState<PrintMode>('managerial');
  const [printLang, setPrintLang] = useState<Lang>(lang);
  const fileRef = useRef<HTMLInputElement>(null);

  const chosen = useMemo(() => dishes.filter(d => selected.has(d.id)), [dishes, selected]);
  const tp = useMemo(() => i18n.getFixedT(printLang), [i18n, printLang]);

  if (!restaurant) return null;

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importBackup(restaurant.id, await file.text());
    window.location.reload();
  };

  const sheets = chosen.map(d => (
    <PrintableSheet key={d.id} dish={d} ingredients={ingredients} restaurant={restaurant} mode={mode} lang={printLang} t={tp} />
  ));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileDown size={24} className="text-blue-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-navy-900">{t('print.title')}</h1>
      </div>

      <div className="grid lg:grid-cols-[22rem_1fr] gap-6 items-start">
        <div className="space-y-4">
          <section className="card p-4">
            <fieldset>
              <legend className="label">{t('print.mode')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {([['managerial', ClipboardList], ['kitchen', ChefHat]] as const).map(([m, Icon]) => (
                  <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
                    className={`text-left rounded-xl border p-3 ${mode === m ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-blue-50'}`}>
                    <span className="flex items-center gap-1.5 font-semibold text-navy-900 text-sm"><Icon size={15} /> {t(`print.${m}`)}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{t(`print.${m}Hint`)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="label">{t('export.language')}</legend>
              <div className="flex gap-2">
                {(['pt', 'en', 'es'] as Lang[]).map(l => (
                  <button key={l} onClick={() => setPrintLang(l)} aria-pressed={printLang === l}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${printLang === l ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-blue-50'}`}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="label !mb-0">{t('print.selectSheets')} ({chosen.length}/{dishes.length})</span>
              <button onClick={() => setSelected(new Set(dishes.map(d => d.id)))} className="ml-auto text-xs text-blue-700 hover:underline">{t('print.selectAll')}</button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-blue-700 hover:underline">{t('print.selectNone')}</button>
            </div>
            <ul className="max-h-72 overflow-auto scrollbar-thin -mx-1">
              {dishes.map(d => (
                <li key={d.id}>
                  <label className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-blue-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="accent-blue-600 w-4 h-4" />
                    <span className="truncate">{d.nome[lang] || d.nome.pt}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button onClick={() => window.print()} disabled={chosen.length === 0} className="btn-primary w-full mt-3">
              <Printer size={15} /> {t('print.print')}
            </button>
            <p className="text-xs text-slate-500 mt-2">{chosen.length === 0 ? t('print.noneSelected') : t('print.printHint')}</p>
            {mode === 'managerial' && (
              <button onClick={() => download(`${restaurant.name}.csv`, buildCSV(chosen, ingredients, printLang), 'text/csv;charset=utf-8;')}
                disabled={chosen.length === 0} className="btn-secondary w-full mt-2">
                <Download size={15} /> {t('export.exportCSV')}
              </button>
            )}
          </section>

          <section className="card p-4">
            <h2 className="label">Backup</h2>
            <p className="text-xs text-slate-500 mb-3">{t('export.backupScope')}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={async () => download(`chefcalc-${restaurant.name}-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup(restaurant.id, restaurant.name), 'application/json')} className="btn-secondary">
                <Download size={15} /> {t('export.backupExport')}
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn-secondary"><Upload size={15} /> {t('export.backupImport')}</button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </div>
          </section>
        </div>

        {/* Pré-visualização na tela */}
        <section className="card p-4 md:p-6 bg-slate-100 min-h-[20rem]" aria-label="Preview">
          {chosen.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-16">{t('print.noneSelected')}</p>
          ) : (
            <div className="space-y-6">
              {chosen.map(d => (
                <div key={d.id} className="bg-white shadow mx-auto w-full max-w-[8.5in] p-[0.5in]">
                  <PrintableSheet dish={d} ingredients={ingredients} restaurant={restaurant} mode={mode} lang={printLang} t={tp} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {createPortal(<div className="print-root">{sheets}</div>, document.body)}
    </div>
  );
}
