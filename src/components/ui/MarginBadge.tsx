import { useTranslation } from 'react-i18next';

interface Props {
  status: 'green' | 'yellow' | 'red';
  value?: number;
  showLabel?: boolean;
}

export function MarginBadge({ status, value, showLabel = true }: Props) {
  const { t } = useTranslation();

  const colors = {
    green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    yellow: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
  };

  const dots = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {value !== undefined && <span>{value.toFixed(1)}%</span>}
      {showLabel && <span>{t(`margin.${status}`)}</span>}
    </span>
  );
}
