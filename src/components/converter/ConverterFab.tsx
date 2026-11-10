import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale, X } from 'lucide-react';
import { ConverterPanel } from './ConverterPanel';

// Botão flutuante que abre o conversor como modal, disponível em qualquer tela.
export function ConverterFab() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      // Atalho: Ctrl/Cmd + K abre o conversor rápido
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t('converter.quickTool')}
        className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors"
      >
        <Scale size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div
            className="bg-gray-50 rounded-2xl shadow-xl w-full max-w-lg mt-10 mb-10 p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-blue-600" />
                <h2 className="font-bold text-gray-900">{t('converter.quickTool')}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-md">
                <X size={18} />
              </button>
            </div>
            <ConverterPanel compact />
          </div>
        </div>
      )}
    </>
  );
}
