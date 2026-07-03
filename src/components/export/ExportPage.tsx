import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Download, Upload, Printer } from 'lucide-react';
import { useDishes } from '../../hooks/useDishes';
import { useIngredients } from '../../hooks/useIngredients';
import { calcDish, calcItemCost, laborCost, formatCurrency } from '../../utils/calculations';
import { exportBackup, importBackup } from '../../db';
import type { Lang, Dish, Ingredient } from '../../types';

type ExportType = 'operational' | 'managerial' | 'both';

function buildCSV(dish: Dish, ingredients: Ingredient[], lang: Lang): string {
  const ingMap = new Map(ingredients.map(i => [i.id, i]));
  const rows: string[] = [];
  rows.push(`"${dish.nome[lang] || dish.nome.pt}"`);
  rows.push('');
  rows.push('Ingrediente,Quantidade,Unidade,Custo');
  for (const item of dish.itens) {
    const ing = ingMap.get(item.ingredienteId);
    if (!ing) continue;
    const cost = calcItemCost(ing, item.quantidadeUsada, item.unidade);
    rows.push(`"${ing.nome[lang] || ing.nome.pt}",${item.quantidadeUsada},${item.unidade},${cost.toFixed(2)}`);
  }
  return rows.join('\n');
}

function PrintableSheet({ dish, ingredients, type, lang }: {
  dish: Dish; ingredients: Ingredient[]; type: ExportType; lang: Lang;
}) {
  const ingMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);
  const calc = useMemo(() => calcDish(dish, ingredients), [dish, ingredients]);

  return (
    <div id="print-area" className="bg-white p-8 font-sans text-sm max-w-2xl">
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{dish.nome[lang] || dish.nome.pt}</h1>
        {dish.categoria && <p className="text-gray-500 mt-1">{dish.categoria}</p>}
        <p className="text-gray-500 text-xs mt-1">Rendimento: {dish.rendimentoPorcoes} porções</p>
      </div>

      {(type === 'operational' || type === 'both') && (
        <div className="mb-6">
          <h2 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 border-b pb-1">Ingredientes</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 font-semibold">Ingrediente</th>
                <th className="text-right p-2 font-semibold">Quantidade</th>
                <th className="text-center p-2 font-semibold">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {dish.itens.map((item, i) => {
                const ing = ingMap.get(item.ingredienteId);
                if (!ing) return null;
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2">{ing.nome[lang] || ing.nome.pt}</td>
                    <td className="p-2 text-right">{item.quantidadeUsada}</td>
                    <td className="p-2 text-center">{item.unidade}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(type === 'operational' || type === 'both') && dish.etapas.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 border-b pb-1">Modo de Preparo</h2>
          <ol className="space-y-3">
            {dish.etapas.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{step.ordem}</span>
                <div>
                  <p>{step.descricao[lang] || step.descricao.pt}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    {step.tempoMinutos > 0 && <span>{step.tempoMinutos}min</span>}
                    {step.temperatura && <span>{step.temperatura}</span>}
                    {step.equipamento && <span>{step.equipamento}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(type === 'managerial' || type === 'both') && (
        <div className="mb-6">
          <h2 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 border-b pb-1">Custos (Gerencial)</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 font-semibold">Ingrediente</th>
                <th className="text-right p-2 font-semibold">Qty</th>
                <th className="text-center p-2 font-semibold">Un.</th>
                <th className="text-right p-2 font-semibold">Custo</th>
              </tr>
            </thead>
            <tbody>
              {dish.itens.map((item, i) => {
                const ing = ingMap.get(item.ingredienteId);
                if (!ing) return null;
                const cost = calcItemCost(ing, item.quantidadeUsada, item.unidade);
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2">{ing.nome[lang] || ing.nome.pt}</td>
                    <td className="p-2 text-right">{item.quantidadeUsada}</td>
                    <td className="p-2 text-center">{item.unidade}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 border-t pt-3 grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-600">Custo insumos:</span><span className="text-right font-mono">{formatCurrency(calc.custoInsumos)}</span>
            <span className="text-gray-600">Mão de obra:</span><span className="text-right font-mono">{formatCurrency(laborCost(dish))}</span>
            <span className="font-semibold">Custo total/porção:</span><span className="text-right font-mono font-semibold">{formatCurrency(calc.custoTotalPorcao)}</span>
            <span className="font-bold text-amber-700">Preço sugerido:</span><span className="text-right font-mono font-bold text-amber-700">{formatCurrency(calc.precoVendaSugerido)}</span>
            <span className="text-gray-600">CMV %:</span><span className="text-right font-mono">{calc.cmvPct.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExportPage() {
  const { t, i18n } = useTranslation();
  const { dishes } = useDishes();
  const { ingredients } = useIngredients();
  const [selectedId, setSelectedId] = useState('');
  const [exportType, setExportType] = useState<ExportType>('both');
  const [exportLang, setExportLang] = useState<Lang>(i18n.language as Lang);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = i18n.language as Lang;

  const dish = useMemo(() => dishes.find(d => d.id === selectedId), [dishes, selectedId]);

  const handlePrint = () => {
    setShowPreview(true);
    setTimeout(() => window.print(), 300);
  };

  const handleCSV = () => {
    if (!dish) return;
    const csv = buildCSV(dish, ingredients, exportLang);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dish.nome[exportLang] || dish.nome.pt}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupExport = async () => {
    const json = await exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chefcalc-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importBackup(text);
    alert('Backup importado com sucesso!');
    window.location.reload();
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileDown size={24} className="text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900">{t('export.title')}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">{t('export.selectDish')}</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">—</option>
            {dishes.map(d => (
              <option key={d.id} value={d.id}>{d.nome[lang] || d.nome.pt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">{t('export.type')}</label>
          <div className="flex gap-2 flex-wrap">
            {(['operational', 'managerial', 'both'] as ExportType[]).map(type => (
              <button
                key={type}
                onClick={() => setExportType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  exportType === type
                    ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t(`export.${type}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">{t('export.language')}</label>
          <div className="flex gap-2">
            {(['pt', 'en', 'es'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setExportLang(l)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  exportLang === l
                    ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handlePrint}
            disabled={!dish}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Printer size={15} />
            {t('export.generatePDF')}
          </button>
          <button
            onClick={handleCSV}
            disabled={!dish}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={15} />
            {t('export.exportCSV')}
          </button>
        </div>
      </div>

      {/* Backup section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Backup</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBackupExport}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={15} />
            {t('export.backupExport')}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload size={15} />
            {t('export.backupImport')}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleBackupImport} />
        </div>
      </div>

      {/* Print preview (hidden, shown on print) */}
      {showPreview && dish && (
        <div className="print-only fixed inset-0 z-50 bg-white overflow-auto">
          <PrintableSheet dish={dish} ingredients={ingredients} type={exportType} lang={exportLang} />
        </div>
      )}

      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-only { display: block !important; position: static !important; }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  );
}
