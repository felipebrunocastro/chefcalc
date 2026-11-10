import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Minus, Plus, Trash2, CheckCircle2, Loader2, Star, ShoppingBag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '../../lib/currency';
import { cartTotals, saleCode } from '../../lib/pos/cash';
import { Modal } from './Modal';
import type { CartLine, PosProduct, PosSale, SaleItem } from '../../lib/pos/types';
import type { NewSale } from '../../data/posRepo';

interface Props {
  products: PosProduct[];
  sales: PosSale[];               // histórico (para "mais vendidos")
  sessionId: string; opDate: string;
  defaultTaxPct: number; maxDiscountPct: number; isOwner: boolean;
  onSubmit: (v: NewSale) => Promise<PosSale>;
}

export function SellScreen({ products, sales, sessionId, opDate, defaultTaxPct, maxDiscountPct, isOwner, onSubmit }: Props) {
  const { t } = useTranslation();
  const [cat, setCat] = useState<string>('__all');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [received, setReceived] = useState('');
  const [picking, setPicking] = useState<PosProduct | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const tokenRef = useRef<string>(uuidv4());          // uma venda = um token (idempotência)
  const lock = useRef(false);

  const active = products.filter(p => p.active);
  const cats = [...new Set(active.map(p => p.category).filter(Boolean))];
  const topIds = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of sales) if (s.status === 'completed') for (const i of s.items) count.set(i.productId, (count.get(i.productId) ?? 0) + i.qty);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  }, [sales]);
  const shown = active.filter(p => (cat === '__all' || (cat === '__top' ? topIds.includes(p.id) : p.category === cat)) && p.name.toLowerCase().includes(q.trim().toLowerCase()));

  const taxOf = (p: PosProduct) => (p.taxPct ?? defaultTaxPct) || 0;
  const addLine = (p: PosProduct, sizeId?: string, addonIds: string[] = []) => {
    const size = p.sizes.find(s => s.id === sizeId);
    const addons = p.addons.filter(a => addonIds.includes(a.id));
    const unitPrice = Math.round(((size ? size.price : p.price) + addons.reduce((a, x) => a + x.price, 0)) * 100) / 100;
    const key = `${p.id}|${size?.id ?? ''}|${addons.map(a => a.id).sort().join(',')}`;
    setLines(ls => ls.some(l => l.key === key)
      ? ls.map(l => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
      : [...ls, { key, productId: p.id, name: p.name, size: size?.name ?? null, addons: addons.map(a => a.name), qty: 1, unitPrice, taxPct: taxOf(p) }]);
    if (state === 'saved') setState('idle');
  };
  const tap = (p: PosProduct) => (p.sizes.length || p.addons.length ? setPicking(p) : addLine(p));
  const setQty = (key: string, qty: number) => setLines(ls => (qty <= 0 ? ls.filter(l => l.key !== key) : ls.map(l => (l.key === key ? { ...l, qty } : l))));

  const disc = discount.trim() === '' ? 0 : Number(discount);
  const recv = received.trim() === '' ? null : Number(received);
  const totals = cartTotals(lines, disc, recv);
  const discPct = totals.subtotal > 0 ? (disc / totals.subtotal) * 100 : 0;
  const discountOver = !isOwner && discPct > maxDiscountPct + 0.0001;
  const canConfirm = lines.length > 0 && !discountOver && !totals.short && state !== 'saving';

  const quick = useMemo(() => {
    const tot = totals.total;
    const opts = new Set<number>([tot]);
    for (const step of [5, 10, 20, 50, 100]) opts.add(Math.ceil(tot / step) * step);
    return [...opts].filter(v => v >= tot && v > 0).sort((a, b) => a - b).slice(0, 5);
  }, [totals.total]);

  const confirm = async () => {
    if (!canConfirm || lock.current) return;          // trava contra toque repetido
    lock.current = true; setState('saving');
    const items: SaleItem[] = lines.map(l => ({ productId: l.productId, name: l.name, size: l.size, addons: l.addons, qty: l.qty, unitPrice: l.unitPrice, lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100, taxPct: l.taxPct }));
    try {
      const s = await onSubmit({
        sessionId, opDate, code: saleCode(), clientToken: tokenRef.current, items,
        subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total,
        received: recv ?? totals.total, change: recv === null ? 0 : totals.change,
      });
      setMsg(t('pos.saved', { code: s.code })); setState('saved');
      setLines([]); setDiscount(''); setReceived(''); setQ(''); tokenRef.current = uuidv4();
    } catch (e) {
      setMsg(t('pos.error', { msg: (e as Error).message })); setState('error');    // mesmo token na nova tentativa
    }
    lock.current = false;
  };

  return (
    <div className="grid lg:grid-cols-[1fr_24rem] gap-4">
      {/* Catálogo */}
      <section className="min-w-0">
        <div className="relative mb-3">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('pos.search')} aria-label={t('pos.search')} className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-base focus:outline-none focus:ring-4 focus:ring-blue-200" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" role="tablist">
          {[['__all', t('pos.all')], ...(topIds.length ? [['__top', t('pos.top')]] : []), ...cats.map(c => [c, c])].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={cat === id} onClick={() => setCat(id)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold border ${cat === id ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-slate-700 border-slate-200'}`}>
              {id === '__top' && <Star size={14} />} {label}
            </button>
          ))}
        </div>
        {active.length === 0 ? <p className="text-slate-500 py-10 text-center">{t('pos.noProducts')}</p> : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-1">
            {shown.map(p => (
              <li key={p.id}>
                <button onClick={() => tap(p)} className="w-full h-28 rounded-2xl bg-white border-2 border-blue-100 hover:border-blue-400 active:scale-[0.98] p-3 text-left flex flex-col shadow-sm">
                  <span className="font-semibold text-navy-900 leading-tight line-clamp-2">{p.name}</span>
                  <span className="text-xs text-slate-500 mt-0.5">{p.category}</span>
                  <span className="mt-auto font-mono font-bold text-blue-700 text-lg">{formatCurrency(p.price)}{p.sizes.length ? '+' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Carrinho */}
      <aside className="lg:sticky lg:top-28 self-start rounded-3xl bg-white border border-blue-100 shadow-md p-4 space-y-3" aria-label={t('pos.cart')}>
        <h2 className="font-bold text-navy-900 flex items-center gap-2"><ShoppingBag size={18} /> {t('pos.cart')}</h2>
        {state === 'saved' && <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2 font-semibold flex items-center gap-2" role="status"><CheckCircle2 size={18} /> {msg}</p>}
        {state === 'error' && <p className="rounded-xl bg-red-50 border border-red-200 text-red-900 px-3 py-2 text-sm" role="alert">{msg}</p>}
        {lines.length === 0 ? <p className="text-slate-500 text-sm">{t('pos.empty')}</p> : (
          <ul className="divide-y divide-slate-100 max-h-[40vh] overflow-auto">
            {lines.map(l => (
              <li key={l.key} className="py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-navy-900 truncate">{l.name}{l.size ? ` · ${l.size}` : ''}</div>
                  {l.addons.length > 0 && <div className="text-xs text-slate-500 truncate">+ {l.addons.join(', ')}</div>}
                  <div className="text-xs text-slate-500 font-mono">{formatCurrency(l.unitPrice)}</div>
                </div>
                <button onClick={() => setQty(l.key, l.qty - 1)} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center" aria-label={`− ${l.name}`}>{l.qty === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button>
                <span className="w-7 text-center font-bold" aria-label={t('pos.qty')}>{l.qty}</span>
                <button onClick={() => setQty(l.key, l.qty + 1)} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center" aria-label={`+ ${l.name}`}><Plus size={16} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="sell-disc" className="block text-xs text-slate-500">{t('pos.discount')}</label>
            <input id="sell-disc" type="number" inputMode="decimal" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className={`field !py-2 text-base font-mono ${discountOver ? '!border-red-500' : ''}`} />
          </div>
          <div>
            <label htmlFor="sell-recv" className="block text-xs text-slate-500">{t('pos.received')} ({t('pos.cash')})</label>
            <input id="sell-recv" type="number" inputMode="decimal" min="0" step="0.01" value={received} onChange={e => setReceived(e.target.value)} className="field !py-2 text-base font-mono" />
          </div>
        </div>
        {!isOwner && <p className={`text-[11px] ${discountOver ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>{discountOver ? t('pos.discountOver', { pct: maxDiscountPct }) : t('pos.discountMax', { pct: maxDiscountPct })}</p>}
        {lines.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {quick.map((v, i) => <button key={v} onClick={() => setReceived(String(v))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono font-semibold hover:bg-blue-50">{i === 0 ? t('pos.exact') : formatCurrency(v)}</button>)}
          </div>
        )}
        <dl className="text-sm space-y-1">
          <div className="flex justify-between"><dt className="text-slate-600">{t('pos.subtotal')}</dt><dd className="font-mono">{formatCurrency(totals.subtotal)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between"><dt className="text-slate-600">{t('pos.discount')}</dt><dd className="font-mono">−{formatCurrency(totals.discount)}</dd></div>}
          {totals.tax > 0 && <div className="flex justify-between"><dt className="text-slate-600">{t('pos.tax')}</dt><dd className="font-mono">{formatCurrency(totals.tax)}</dd></div>}
          <div className="flex justify-between items-baseline pt-1 border-t border-slate-100"><dt className="font-bold text-navy-900">{t('pos.total')}</dt><dd className="font-mono font-extrabold text-3xl text-navy-900" data-testid="cart-total">{formatCurrency(totals.total)}</dd></div>
          {totals.change !== null && (
            <div className={`flex justify-between items-baseline rounded-xl px-3 py-2 ${totals.short ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'}`}>
              <dt className="font-semibold">{totals.short ? t('pos.missing', { v: formatCurrency(-totals.change) }) : t('pos.change')}</dt>
              {!totals.short && <dd className="font-mono font-extrabold text-2xl" data-testid="cart-change">{formatCurrency(totals.change)}</dd>}
            </div>
          )}
        </dl>
        <p className="text-xs text-slate-500">{t('pos.payment')}: <b>{t('pos.cash')}</b></p>
        <button onClick={confirm} disabled={!canConfirm} className="btn-primary w-full !py-4 text-lg !rounded-2xl" aria-busy={state === 'saving'}>
          {state === 'saving' ? <><Loader2 size={20} className="animate-spin" /> {t('pos.savingSale')}</> : <><CheckCircle2 size={20} /> {t('pos.confirm')}</>}
        </button>
        {lines.length > 0 && state !== 'saving' && <button onClick={() => { setLines([]); setDiscount(''); setReceived(''); }} className="w-full text-sm text-slate-500 hover:text-red-600">{t('pos.clear')}</button>}
      </aside>

      {picking && <OptionPicker product={picking} onClose={() => setPicking(null)} onAdd={(s, a) => { addLine(picking, s, a); setPicking(null); }} />}
    </div>
  );
}

function OptionPicker({ product, onAdd, onClose }: { product: PosProduct; onAdd: (sizeId: string | undefined, addonIds: string[]) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [size, setSize] = useState<string | undefined>(product.sizes[0]?.id);
  const [addons, setAddons] = useState<string[]>([]);
  const price = (product.sizes.find(s => s.id === size)?.price ?? product.price) + product.addons.filter(a => addons.includes(a.id)).reduce((a, x) => a + x.price, 0);
  return (
    <Modal title={product.name} onClose={onClose} footer={<button onClick={() => onAdd(size, addons)} className="btn-primary !py-3 !px-6 text-base">{t('pos.add')} · {formatCurrency(price)}</button>}>
      {product.sizes.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-600 mb-2">{t('pos.size')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {product.sizes.map(s => <button key={s.id} type="button" onClick={() => setSize(s.id)} aria-pressed={size === s.id} className={`rounded-2xl border-2 px-4 py-3 text-left ${size === s.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}><span className="font-semibold">{s.name}</span><span className="block font-mono text-sm">{formatCurrency(s.price)}</span></button>)}
          </div>
        </fieldset>
      )}
      {product.addons.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-600 mb-2">{t('pos.addons')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {product.addons.map(a => <label key={a.id} className={`rounded-2xl border-2 px-4 py-3 flex items-center gap-2 cursor-pointer ${addons.includes(a.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}><input type="checkbox" checked={addons.includes(a.id)} onChange={() => setAddons(x => (x.includes(a.id) ? x.filter(i => i !== a.id) : [...x, a.id]))} className="w-5 h-5 accent-blue-600" /><span className="flex-1">{a.name}</span><span className="font-mono text-sm">+{formatCurrency(a.price)}</span></label>)}
          </div>
        </fieldset>
      )}
    </Modal>
  );
}
