import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';
import { ConverterPanel } from './ConverterPanel';

export function ConverterPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Scale size={24} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t('converter.title')}</h1>
      </div>
      <ConverterPanel />
    </div>
  );
}
