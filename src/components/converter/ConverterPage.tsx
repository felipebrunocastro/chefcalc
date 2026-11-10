import { useTranslation } from 'react-i18next';
import { Mascot } from '../ui/Mascot';
import { ConverterPanel } from './ConverterPanel';

export function ConverterPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Mascot variant="converter" size={72} decorative className="shrink-0 -my-2" />
        <h1 className="text-2xl font-bold text-gray-900">{t('converter.title')}</h1>
      </div>
      <ConverterPanel />
    </div>
  );
}
