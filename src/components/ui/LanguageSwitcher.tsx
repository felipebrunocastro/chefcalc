import { useTranslation } from 'react-i18next';
import type { Lang } from '../../types';

const LANGS: { code: Lang; flag: string }[] = [
  { code: 'pt', flag: '🇧🇷' },
  { code: 'en', flag: '🇺🇸' },
  { code: 'es', flag: '🇪🇸' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language as Lang;
  const changeLang = (lang: Lang) => { i18n.changeLanguage(lang); localStorage.setItem('lang', lang); };
  return (
    <div className="flex items-center gap-1">
      {LANGS.map(l => (
        <button key={l.code} onClick={() => changeLang(l.code)}
          className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            current === l.code ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}>
          {l.flag} {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
