import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from './pt.json';
import en from './en.json';
import es from './es.json';
import { extra } from './extra';

type Obj = Record<string, unknown>;
function merge(base: Obj, over: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object'
      ? merge(base[k] as Obj, v as Obj)
      : v;
  }
  return out;
}

const savedLang = localStorage.getItem('lang') || 'pt';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: merge(pt, extra.pt) },
      en: { translation: merge(en, extra.en) },
      es: { translation: merge(es, extra.es) },
    },
    lng: savedLang,
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
  });

export default i18n;
