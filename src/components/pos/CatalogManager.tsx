import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ClipboardList, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '../../lib/currency';
import { calcDish } from '../../utils/calculations';
import { useDishes } from '../../hooks/useDishes';
import { useIngredients } from '../../hooks/useIngredients';
import { useRestaurant } from '../../hooks/useRestaurant';
import { saveProduct, deleteProduct } from '../../data/posRepo';
import { Modal } from './Modal';
import type { PosOption, PosProduct } from '../../lib/pos/types';
import type { Lang } from '../../types';

const toText = (o: PosOption[]) => o.map(x => `${x.name} = ${x.price}`).join('\n');
const fromText = (s: string): PosOption[] => s.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const [name, price] = l.split('=').map(x => x.trim());
  return { id: uuidv4(), name, price: Number((price ?? '0').replace(',', '.')) || 0 };
});

export function CatalogManager({ products, onChanged }: { products: PosProduct[]; onChanged: () => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { current, update } = useRestaurant();
  const { dishes } = useDishes();
  const { ingredients } = useIngredients();
  const [edit, setEdit] = useState<Partial<PosProduct> | null>(null);
  const [sizesText, setSizesText] = useState('');
  const [addonsText, setAddonsText] = useState('');
  const [msg, setMsg] = useState('');
  const pos = current?.profile.pos ?? {};
  const [tax, setTax] = useState(String(pos.taxPct ?? ''));
  const [maxDisc, setMaxDisc] = useState(String(pos.maxDiscountPct ?? 10));
  const [unitsText, setUnitsText] = useState((pos.units ?? []).join('\n'));
  if (!current) return null;

  const open = (p?: PosProduct) => { setEdit(p ?? { name: '', category: '', price: 0, active: true, sizes: [], addons: [], taxPct: null }); setSizesText(toText(p?.sizes ?? [])); setAddonsText(toText(p?.addons ?? [])); };
  const save = async () => {
    if (!edit?.name?.trim()) return;
    await saveProduct(current.id, { ...edit, name: edit.name, price: Number(edit.price) || 0, sizes: fromText(sizesText), addons: fromText(addonsText) });
    setEdit(null); await onChanged();
  };
  const importDishes = async () => {
    const linked = new Set(products.map(p => p.dishId).filter(Boolean));
    const todo = dishes.filter(d => !linked.has(d.id));
    for (const d of todo) {
      const c = calcDish(d, ingredients);
      await saveProduct(current.id, { name: d.nome[lang] || d.nome.pt, category: d.categoria || '', price: Math.round(c.precoVendaSugerido * 100) / 100, dishId: d.id, active: true });
    }
    setMsg(t('catalog.added', { n: todo.length })); await onChanged();
  };
  const saveSettings = async () => {
    await update(current.id, { profile: { ...current.profile, pos: { taxPct: tax.trim() === '' ? null : Number(tax), maxDiscountPct: Number(maxDisc) || 0, units: unitsText.split('\n').map(x => x.trim()).filter(Boolean) } } });
    setMsg(t('catalog.settingsSaved'));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white border border-blue-100 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-navy-900">{t('catalog.title')}</h2>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={importDishes} className="btn-secondary !py-2.5"><ClipboardList size={16} /> {t('catalog.fromSheets')}</button>
            <button onClick={() => open()} className="btn-primary !py-2.5"><Plus size={16} /> {t('catalog.add')}</button>
          </div>
        </div>
        <p className="text-sm text-slate-600">{t('catalog.hint')}</p>
        {msg && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2" role="status">{msg}</p>}
        <ul className="divide-y divide-slate-100">
          {products.map(p => (
            <li key={p.id} className={`py-2 flex items-center gap-3 ${p.active ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-navy-900">{p.name} {p.dishId && <ClipboardList size={12} className="inline text-blue-500" aria-label="ficha" />}</div>
                <div className="text-xs text-slate-500">{p.category || '—'} · {p.sizes.length ? p.sizes.map(s => `${s.name} ${formatCurrency(s.price)}`).join(' / ') : formatCurrency(p.price)}{p.addons.length ? ` · +${p.addons.length}` : ''} · {p.taxPct == null ? '' : `${p.taxPct}%`}</div>
              </div>
              <span className="font-mono font-semibold">{formatCurrency(p.price)}</span>
              <button onClick={() => open(p)} className="btn-ghost" aria-label={`${t('catalog.edit')} ${p.name}`}><Pencil size={16} /></button>
              <button onClick={async () => { await deleteProduct(p.id); await onChanged(); }} className="btn-ghost hover:!text-red-600" aria-label={`${t('catalog.remove')} ${p.name}`}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white border border-blue-100 p-4 space-y-3">
        <h2 className="font-bold text-navy-900">{t('catalog.settings')}</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label htmlFor="pos-tax" className="label">{t('catalog.defaultTax')}</label><input id="pos-tax" type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} className="field" placeholder={t('catalog.noTax')} /></div>
          <div><label htmlFor="pos-disc" className="label">{t('catalog.maxDiscount')}</label><input id="pos-disc" type="number" step="0.5" value={maxDisc} onChange={e => setMaxDisc(e.target.value)} className="field" /></div>
          <div><label htmlFor="pos-units" className="label">{t('pos.unit')} (1/{t('catalog.name').toLowerCase()})</label><textarea id="pos-units" rows={2} value={unitsText} onChange={e => setUnitsText(e.target.value)} className="field" placeholder={current.profile.unitName || 'Centro'} /></div>
        </div>
        <button onClick={saveSettings} className="btn-primary"><Save size={16} /> {t('catalog.save')}</button>
      </section>

      {edit && (
        <Modal title={edit.id ? t('catalog.edit') : t('catalog.add')} onClose={() => setEdit(null)} footer={<button onClick={save} className="btn-primary !py-3 !px-6">{t('catalog.save')}</button>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label htmlFor="pp-name" className="label">{t('catalog.name')}</label><input id="pp-name" value={edit.name ?? ''} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} className="field !py-2.5" /></div>
            <div><label htmlFor="pp-cat" className="label">{t('catalog.category')}</label><input id="pp-cat" list="pp-cats" value={edit.category ?? ''} onChange={e => setEdit(x => ({ ...x, category: e.target.value }))} className="field !py-2.5" /><datalist id="pp-cats">{[...new Set(products.map(p => p.category))].map(c => <option key={c} value={c} />)}</datalist></div>
            <div><label htmlFor="pp-price" className="label">{t('catalog.price')}</label><input id="pp-price" type="number" step="0.01" value={edit.price ?? 0} onChange={e => setEdit(x => ({ ...x, price: Number(e.target.value) }))} className="field !py-2.5" /></div>
            <div><label htmlFor="pp-tax" className="label">{t('catalog.taxPct')}</label><input id="pp-tax" type="number" step="0.01" value={edit.taxPct ?? ''} onChange={e => setEdit(x => ({ ...x, taxPct: e.target.value === '' ? null : Number(e.target.value) }))} className="field !py-2.5" placeholder={String(pos.taxPct ?? '')} /></div>
            <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={edit.active !== false} onChange={e => setEdit(x => ({ ...x, active: e.target.checked }))} className="w-5 h-5 accent-blue-600" /> {t('catalog.active')}</label>
            <div className="col-span-2"><label htmlFor="pp-sizes" className="label">{t('catalog.sizes')}</label><textarea id="pp-sizes" rows={2} value={sizesText} onChange={e => setSizesText(e.target.value)} className="field" placeholder="P = 4.50&#10;G = 6" /></div>
            <div className="col-span-2"><label htmlFor="pp-addons" className="label">{t('catalog.addons')}</label><textarea id="pp-addons" rows={2} value={addonsText} onChange={e => setAddonsText(e.target.value)} className="field" placeholder="Bacon = 2" /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
