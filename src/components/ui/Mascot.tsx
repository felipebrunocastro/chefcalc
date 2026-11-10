import { useTranslation } from 'react-i18next';

// Se existir src/assets/mascot/chef-custom.(svg|png|webp), ele substitui o mascote provisório.
const custom = Object.values(
  import.meta.glob('../../assets/mascot/chef-custom.{svg,png,webp}', { eager: true, query: '?url', import: 'default' }),
)[0] as string | undefined;

interface Props { size?: number; className?: string; decorative?: boolean }

export function Mascot({ size = 120, className = '', decorative = false }: Props) {
  const { t } = useTranslation();
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': t('mascot.alt') };

  if (custom) {
    return <img src={custom} width={size} height={size} alt={decorative ? '' : t('mascot.alt')} className={`object-contain ${className}`} />;
  }

  // Mascote provisório: chef simpático, chapéu branco e avental azul. Formas simples para ler bem em tamanhos pequenos.
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} {...a11y}>
      <circle cx="60" cy="64" r="54" fill="#dbeafe" />
      {/* chapéu */}
      <path d="M36 40c-8 0-13-6-13-13s6-13 13-13c2-8 9-13 17-12 4-4 10-4 14 0 8-1 15 4 17 12 7 0 13 6 13 13s-5 13-13 13z" fill="#fff" stroke="#0b1f4b" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="38" y="36" width="44" height="12" rx="3" fill="#fff" stroke="#0b1f4b" strokeWidth="2.5" />
      {/* rosto */}
      <circle cx="60" cy="64" r="20" fill="#f6c9a5" stroke="#0b1f4b" strokeWidth="2.5" />
      <circle cx="52.5" cy="62" r="2.6" fill="#0b1f4b" />
      <circle cx="67.5" cy="62" r="2.6" fill="#0b1f4b" />
      <circle cx="47" cy="69" r="3" fill="#f59e9e" opacity=".6" />
      <circle cx="73" cy="69" r="3" fill="#f59e9e" opacity=".6" />
      <path d="M53 71c4 4 10 4 14 0" fill="none" stroke="#0b1f4b" strokeWidth="2.5" strokeLinecap="round" />
      {/* bigode */}
      <path d="M50 68c4-3 7-3 10 0 3-3 6-3 10 0" fill="none" stroke="#0b1f4b" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      {/* corpo + avental azul */}
      <path d="M28 116c2-18 14-28 32-28s30 10 32 28z" fill="#fff" stroke="#0b1f4b" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M45 92h30l4 24H41z" fill="#2563eb" stroke="#0b1f4b" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="53" y="100" width="14" height="8" rx="2" fill="#1d4ed8" />
      {/* lenço */}
      <path d="M50 86l10 8 10-8" fill="#60a5fa" stroke="#0b1f4b" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
