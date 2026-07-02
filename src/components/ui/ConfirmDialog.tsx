import { useTranslation } from 'react-i18next';

interface Props { message: string; onConfirm: () => void; onCancel: () => void; }

export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-gray-800 text-base mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600">{t('common.delete')}</button>
        </div>
      </div>
    </div>
  );
}
