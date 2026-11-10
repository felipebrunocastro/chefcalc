import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Diálogo grande para toque (iPad / celular). Fecha com Esc.
export function Modal({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[55] bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94svh] flex flex-col`}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-blue-100">
          <h2 className="text-lg font-bold text-navy-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost ml-auto !p-2" aria-label="✕"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-auto space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-blue-100 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function BigNumberInput({ id, label, value, onChange, autoFocus = false }: { id: string; label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input id={id} type="number" inputMode="decimal" step="0.01" min="0" autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-2xl font-bold font-mono text-navy-900 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500" />
    </div>
  );
}
