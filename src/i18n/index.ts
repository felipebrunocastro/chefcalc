import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from './pt.json';
import en from './en.json';
import es from './es.json';
import { extra } from './extra';
import { extra2 } from './extra2';
import { extra3 } from './extra3';
import { landingText } from './landing';
import { extra4 } from './extra4';
import { extra5 } from './extra5';

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

// Idioma padrão: inglês. Ordem de preferência: inglês → espanhol → português.
const saved = localStorage.getItem('lang');
const savedLang = saved === 'en' || saved === 'es' || saved === 'pt' ? saved : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: merge(merge(merge(merge(merge(merge(pt, extra.pt), extra2.pt), extra3.pt), landingText.pt), extra4.pt), extra5.pt) },
      en: { translation: merge(merge(merge(merge(merge(merge(en, extra.en), extra2.en), extra3.en), landingText.en), extra4.en), extra5.en) },
      es: { translation: merge(merge(merge(merge(merge(merge(es, extra.es), extra2.es), extra3.es), landingText.es), extra4.es), extra5.es) },
    },
    lng: savedLang,
    fallbackLng: ['en', 'es', 'pt'],
    interpolation: { escapeValue: false },
  });

const htmlLang = (l: string) => (l === 'pt' ? 'pt-BR' : l === 'es' ? 'es' : 'en');
document.documentElement.lang = htmlLang(i18n.language);
i18n.on('languageChanged', l => { document.documentElement.lang = htmlLang(l); });

export default i18n;
