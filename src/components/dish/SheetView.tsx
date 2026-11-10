import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer, Eye } from 'lucide-react';
import { useDishes } from '../../hooks/useDishes';
import { useIngredients } from '../../hooks/useIngredients';
import { useRestaurant } from '../../hooks/useRestaurant';
import { PrintableSheet, type PrintMode } from '../export/PrintableSheet';
import type { AppView, Lang } from '../../types';

// Visualização somente leitura de uma ficha técnica (acesso compartilhado).
export function SheetView({ dishId, onNavigate }: { dishId?: string; onNavigate: (v: AppView) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { current: restaurant } = useRestaurant();
  const { dishes, loading } = useDishes();
  const { ingredients } = useIngredients();
  const [mode, setMode] = useState<PrintMode>('managerial');
  const dish = useMemo(() => dishes.find(d => d.id === dishId), [dishes, dishId]);

  if (!restaurant) return null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => onNavigate('dashboard')} className="btn-secondary"><ArrowLeft size={15} /> {t('sheetView.back')}</button>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-1 text-xs font-semibold"><Eye size={13} /> {t('sheetView.readOnly')}</span>
        <div className="ml-auto flex gap-2">
          {(['managerial', 'kitchen'] as PrintMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
              className={`px-3 py-1.5 rounded-lg text-sm border ${mode === m ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold' : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50'}`}>
              {t(`print.${m}`)}
            </button>
          ))}
          <button onClick={() => window.print()} disabled={!dish} className="btn-primary"><Printer size={15} /> <span className="hidden sm:inline">{t('print.print')}</span></button>
        </div>
      </div>
      {loading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : dish ? (
        <>
          <div className="bg-white shadow rounded-2xl p-5 md:p-10">
            <PrintableSheet dish={dish} ingredients={ingredients} restaurant={restaurant} mode={mode} lang={lang} t={t} />
          </div>
          {createPortal(<div className="print-root"><PrintableSheet dish={dish} ingredients={ingredients} restaurant={restaurant} mode={mode} lang={lang} t={t} /></div>, document.body)}
        </>
      ) : null}
    </div>
  );
}
