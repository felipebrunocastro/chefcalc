import { useTranslation } from 'react-i18next';
import type { Lang } from '../../types';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'pt', label: 'PT', flag: '🇧🇷' },
];

export function LanguageSwitcher({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { i18n } = useTranslation();
  const current = i18n.language as Lang;

  const changeLang = (lang: Lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => changeLang(l.code)}
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-xs font-medium transition-colors
            ${current === l.code
              ? 'bg-blue-600 text-white'
              : tone === 'dark' ? 'text-blue-100 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-navy-900'}`}
          aria-pressed={current === l.code}
        >
          <span aria-hidden="true" className="hidden sm:inline">{l.flag}</span>
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  );
}
