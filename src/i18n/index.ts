import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from './pt.json';
import en from './en.json';
import es from './es.json';
import { extra } from './extra';
import { extra2 } from './extra2';
import { extra3 } from './extra3';
import { landingText } from './landing';

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
      pt: { translation: merge(merge(merge(merge(pt, extra.pt), extra2.pt), extra3.pt), landingText.pt) },
      en: { translation: merge(merge(merge(merge(en, extra.en), extra2.en), extra3.en), landingText.en) },
      es: { translation: merge(merge(merge(merge(es, extra.es), extra2.es), extra3.es), landingText.es) },
    },
    lng: savedLang,
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
  });

export default i18n;
