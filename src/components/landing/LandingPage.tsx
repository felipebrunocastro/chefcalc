import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Menu, X, ArrowRight, Calculator, ClipboardList, Package, Scale, Wallet, Truck, Briefcase, Store, Coffee, Croissant, Bike, Utensils,
  ChevronDown, Globe2, CheckCircle2, Clock, Languages, Coins, Ruler, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { navigate } from '../../lib/router';
import { Logo } from '../ui/Logo';
import { Mascot, type MascotVariant } from '../ui/Mascot';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Simulator, PENDING_SIM_KEY, type SimValues } from './Simulator';
import { Preview, type PreviewKind } from './Preview';
import worldDots from '../../assets/world-dots.svg';

const FEATURES: { key: string; icon: typeof ClipboardList; mascot: MascotVariant; preview: PreviewKind }[] = [
  { key: 'sheets', icon: ClipboardList, mascot: 'sheets', preview: 'sheets' },
  { key: 'ingredients', icon: Package, mascot: 'ingredients', preview: 'ingredients' },
  { key: 'converter', icon: Scale, mascot: 'converter', preview: 'converter' },
  { key: 'finance', icon: Wallet, mascot: 'finance', preview: 'finance' },
  { key: 'delivery', icon: Truck, mascot: 'shopping', preview: 'delivery' },
  { key: 'consulting', icon: Briefcase, mascot: 'custom', preview: 'consulting' },
];

// Projeção do mapa (mesma do SVG gerado): x = (lon+180)/360, y = (78−lat)/134.
const pin = (lon: number, lat: number) => ({ left: `${((lon + 180) / 360) * 100}%`, top: `${((78 - lat) / 134) * 100}%` });
const PINS = [
  { lon: -80.2, lat: 25.8, ex: 'ex1' }, { lon: -69.9, lat: 18.5, ex: 'ex3' }, { lon: -99.1, lat: 19.4 },
  { lon: -74.1, lat: 4.7 }, { lon: -46.6, lat: -23.5, ex: 'ex2' }, { lon: -3.7, lat: 40.4 },
];

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    document.title = t('landing.metaTitle');
    document.documentElement.lang = i18n.language === 'pt' ? 'pt-BR' : i18n.language;
  }, [t, i18n.language]);

  const openPanel = () => { sessionStorage.setItem('chefcalc:openPanel', '1'); navigate('/app'); };
  const signup = () => (user ? openPanel() : navigate('/cadastro'));
  const login = () => (user ? openPanel() : navigate('/entrar'));
  const applySim = (v: SimValues) => {
    try { localStorage.setItem(PENDING_SIM_KEY, JSON.stringify(v)); } catch { /* armazenamento indisponível */ }
    signup();
  };
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault(); setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const n = FEATURES.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); setTab(next); tabRefs.current[next]?.focus();
  };

  const f = FEATURES[tab];
  const navLinks = [['recursos', 'features'], ['como-funciona', 'how'], ['para-quem', 'who']] as const;

  return (
    <div className="min-h-screen bg-white text-slate-900 landing">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] btn-primary">ChefCalc</a>

      {/* Cabeçalho */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <a href="/" aria-label="ChefCalc" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0 }); }}><Logo height={30} /></a>
          <nav className="hidden md:flex items-center gap-1 ml-4" aria-label={t('landing.nav.menu')}>
            {navLinks.map(([id, k]) => <a key={id} href={`#${id}`} onClick={go(id)} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50">{t(`landing.nav.${k}`)}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1" aria-label={t('landing.nav.language')} role="group"><Globe2 size={15} className="text-slate-400" aria-hidden="true" /><LanguageSwitcher tone="light" /></div>
            {user ? (
              <button onClick={openPanel} className="btn-primary"><LayoutDashboard size={16} /> {t('landing.nav.openPanel')}</button>
            ) : (
              <button onClick={login} className="btn-secondary">{t('landing.nav.login')}</button>
            )}
            <button className="md:hidden btn-ghost" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-label={t('landing.nav.menu')}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {menu && (
          <nav className="md:hidden border-t border-blue-100 bg-white px-4 py-3 space-y-1" aria-label={t('landing.nav.menu')}>
            {navLinks.map(([id, k]) => <a key={id} href={`#${id}`} onClick={go(id)} className="block px-3 py-2.5 rounded-lg text-base font-medium text-slate-800 hover:bg-blue-50">{t(`landing.nav.${k}`)}</a>)}
            <div className="flex items-center gap-2 px-3 pt-2"><span className="text-sm text-slate-500">{t('landing.nav.language')}</span><LanguageSwitcher tone="light" /></div>
          </nav>
        )}
      </header>

      <main id="conteudo">
        {/* 1. Primeira dobra */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf3ff] via-white to-white">
          <div className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-sky-200/40 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-7xl mx-auto px-4 pt-10 pb-16 md:pt-16 md:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
            <div className="landing-fade">
              <h1 className="text-[2rem] leading-tight md:text-5xl md:leading-[1.08] font-extrabold tracking-tight text-navy-900">{t('landing.hero.title')}</h1>
              <p className="mt-5 text-lg text-slate-600 max-w-xl">{t('landing.hero.subtitle')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#simulador" onClick={go('simulador')} className="btn-primary !px-6 !py-3 text-base"><Calculator size={18} /> {t('landing.hero.ctaSim')}</a>
                <button onClick={signup} className="btn-secondary !px-6 !py-3 text-base">{t('landing.hero.ctaSignup')} <ArrowRight size={18} /></button>
              </div>
            </div>
            <div className="relative">
              <div className="sm:hidden flex justify-center -mb-px relative z-10">
                <Mascot variant="hero" size={176} priority decorative className="w-40 h-40 drop-shadow-xl" />
              </div>
              <div className="hidden sm:block absolute sm:-left-16 bottom-0 z-10 sm:w-56 lg:w-60 pointer-events-none">
                <Mascot variant="hero" size={256} decorative className="w-full h-auto drop-shadow-xl" />
              </div>
              <div className="sm:ml-36 lg:ml-32 landing-float"><Preview kind="overview" /></div>
            </div>
          </div>
        </section>

        {/* 2. Simulador */}
        <section id="simulador" className="scroll-mt-20 bg-[#eaf3ff] py-16 md:py-20">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight">{t('landing.sim.title')}</h2>
            <p className="text-slate-600 mt-2 mb-8 max-w-2xl">{t('landing.sim.subtitle')}</p>
            <Simulator onApply={applySim} />
          </div>
        </section>

        {/* 3. Recursos */}
        <section id="recursos" className="scroll-mt-20 py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight">{t('landing.features.title')}</h2>
            <p className="text-slate-600 mt-2 mb-8">{t('landing.features.subtitle')}</p>
            <div role="tablist" aria-label={t('landing.features.title')} className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
              {FEATURES.map((x, i) => (
                <button key={x.key} ref={el => { tabRefs.current[i] = el; }} role="tab" id={`ftab-${x.key}`} aria-selected={tab === i} aria-controls="fpanel" tabIndex={tab === i ? 0 : -1}
                  onClick={() => setTab(i)} onKeyDown={e => onTabKey(e, i)}
                  className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border ${tab === i ? 'bg-navy-900 text-white border-navy-900 shadow' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                  <x.icon size={16} aria-hidden="true" /> {t(`landing.features.${x.key}.tab`)}
                </button>
              ))}
            </div>
            <div id="fpanel" role="tabpanel" aria-labelledby={`ftab-${f.key}`} className="mt-6 grid lg:grid-cols-2 gap-8 items-center rounded-3xl bg-gradient-to-br from-[#eaf3ff] to-white border border-blue-100 p-5 md:p-10">
              <div key={f.key} className="landing-fade flex gap-4 items-start">
                <Mascot variant={f.mascot} size={128} lazy decorative className="shrink-0 w-24 h-24 md:w-32 md:h-32" />
                <div>
                  <h3 className="text-2xl font-bold text-navy-900">{t(`landing.features.${f.key}.title`)}</h3>
                  <p className="text-slate-700 mt-2">{t(`landing.features.${f.key}.text`)}</p>
                  <p className="mt-3 text-sm font-medium text-blue-800 flex gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {t(`landing.features.${f.key}.action`)}</p>
                </div>
              </div>
              <div key={`p-${f.key}`} className="landing-fade"><Preview kind={f.preview} /></div>
            </div>
          </div>
        </section>

        {/* 4. Mundo */}
        <section className="bg-navy-900 text-white py-16 md:py-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-[1fr_1.3fr] gap-10 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{t('landing.global.title')}</h2>
              <p className="text-blue-100 mt-3">{t('landing.global.text')}</p>
              <ul className="mt-6 space-y-2 text-sm text-blue-100">
                <li className="flex gap-2"><Languages size={18} className="text-sky-300 shrink-0" aria-hidden="true" /> {t('landing.global.langs')}</li>
                <li className="flex gap-2"><Coins size={18} className="text-sky-300 shrink-0" aria-hidden="true" /> {t('landing.global.currencies')}</li>
                <li className="flex gap-2"><Ruler size={18} className="text-sky-300 shrink-0" aria-hidden="true" /> {t('landing.global.units')}</li>
              </ul>
              <div className="mt-6 grid gap-2 text-sm">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3"><span className="font-semibold text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 size={14} /> {t('landing.global.available')}</span><p className="text-blue-100 mt-0.5">{t('landing.global.availableItems')}</p></div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3"><span className="font-semibold text-amber-300 inline-flex items-center gap-1"><Clock size={14} /> {t('landing.global.inDev')}</span><p className="text-blue-100 mt-0.5">{t('landing.global.inDevItems')}</p></div>
                <p className="text-xs text-blue-200">{t('landing.global.availability')}</p>
              </div>
            </div>
            <div>
              <div className="relative" role="img" aria-label={t('landing.global.mapLabel')}>
                <img src={worldDots} alt="" className="w-full h-auto opacity-60" loading="lazy" width={1000} height={372} />
                {PINS.map((p, i) => (
                  <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={pin(p.lon, p.lat)} aria-hidden="true">
                    <span className="block w-3.5 h-3.5 rounded-full bg-sky-400 ring-4 ring-sky-400/30 landing-pulse" />
                  </span>
                ))}
              </div>
              <ul className="mt-6 grid sm:grid-cols-3 gap-3 text-sm">
                {(['ex1', 'ex2', 'ex3'] as const).map(k => (
                  <li key={k} className="rounded-xl bg-white text-slate-800 p-3 shadow">{t(`landing.global.${k}`)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 5. Como funciona */}
        <section id="como-funciona" className="scroll-mt-20 py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight mb-8">{t('landing.how.title')}</h2>
            <ol className="grid md:grid-cols-3 gap-5">
              {[1, 2, 3].map(n => (
                <li key={n} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition">
                  <span className="inline-flex w-9 h-9 rounded-full bg-blue-600 text-white font-bold items-center justify-center" aria-hidden="true">{n}</span>
                  <h3 className="font-bold text-navy-900 text-lg mt-3">{t(`landing.how.s${n}`)}</h3>
                  <p className="text-slate-600 text-sm mt-1">{t(`landing.how.s${n}t`)}</p>
                  <div className="mt-4 rounded-xl bg-[#eaf3ff] p-3 text-xs" aria-hidden="true">
                    {n === 1 && (
                      <div className="flex items-center gap-2">
                        <span className="w-10 h-10 rounded-lg bg-cyan-700 text-white font-bold flex items-center justify-center">BA</span>
                        <div className="flex-1 space-y-1"><div className="rounded bg-white px-2 py-1">{t('landing.how.ex1Name')}: Bistrô Azul</div><div className="rounded bg-white px-2 py-1">{t('landing.how.ex1Currency')}: USD</div></div>
                      </div>
                    )}
                    {n === 2 && (
                      <table className="w-full"><tbody>
                        {[['Beef', '150 g', '$1.39'], ['Bun', '1 un', '$0.50'], ['Cheddar', '20 g', '$0.22']].map(r => <tr key={r[0]}><td className="py-0.5">{r[0]}</td><td>{r[1]}</td><td className="text-right font-mono">{r[2]}</td></tr>)}
                        <tr className="border-t border-blue-200 font-semibold"><td className="pt-1" colSpan={2}>/ porção</td><td className="text-right font-mono pt-1">$2.34</td></tr>
                      </tbody></table>
                    )}
                    {n === 3 && (
                      <div><div className="flex justify-between mb-1"><span>{t('landing.preview.progress')}</span><b>74%</b></div><div className="h-2.5 bg-white rounded-full"><div className="h-2.5 bg-blue-600 rounded-full w-[74%]" /></div></div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Para quem é */}
        <section id="para-quem" className="scroll-mt-20 bg-[#eaf3ff] py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight mb-8">{t('landing.who.title')}</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([['restaurants', Utensils], ['trucks', Truck], ['cafes', Coffee], ['bakeries', Croissant], ['ghost', Bike], ['consultants', Briefcase]] as const).map(([k, Icon]) => (
                <li key={k} className={`rounded-2xl bg-white border p-5 hover:-translate-y-0.5 hover:shadow-md transition ${k === 'consultants' ? 'border-blue-400 ring-1 ring-blue-400 sm:col-span-2 lg:col-span-1' : 'border-blue-100'}`}>
                  <Icon size={26} className="text-blue-600" aria-hidden="true" />
                  <h3 className="font-bold text-navy-900 mt-3">{t(`landing.who.${k}`)}</h3>
                  <p className="text-sm text-slate-600 mt-1">{t(`landing.who.${k}T`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Perguntas frequentes */}
        <section className="py-16 md:py-24">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 tracking-tight mb-6">{t('landing.faq.title')}</h2>
            <div className="divide-y divide-blue-100 border-y border-blue-100">
              {[1, 2, 3, 4, 5].map(n => (
                <details key={n} className="group py-4">
                  <summary className="list-none cursor-pointer flex items-center gap-3 font-semibold text-navy-900 hover:text-blue-700 rounded-lg">
                    {t(`landing.faq.q${n}`)}
                    <ChevronDown size={18} className="ml-auto shrink-0 text-blue-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="mt-2 text-slate-600">{t(`landing.faq.a${n}`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Fechamento */}
        <section className="px-4 pb-16 md:pb-24">
          <div className="max-w-6xl mx-auto rounded-3xl bg-navy-900 text-white p-8 md:p-14 flex flex-col md:flex-row items-center gap-8 overflow-hidden relative">
            <div className="absolute -right-20 -bottom-24 w-80 h-80 rounded-full bg-sky-400/20 blur-2xl" aria-hidden="true" />
            <div className="relative flex-1">
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">{t('landing.final.title')}</h2>
              <button onClick={signup} className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold bg-sky-400 text-navy-950 hover:bg-sky-300">{t('landing.final.cta')} <ArrowRight size={18} /></button>
            </div>
            <Mascot variant="finance" size={200} lazy decorative className="relative w-40 h-40 md:w-52 md:h-52" />
          </div>
        </section>
      </main>

      <footer className="border-t border-blue-100 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <Logo height={24} />
          <span>© {new Date().getFullYear()} {t('landing.footer.rights')}</span>
          <div className="ml-auto flex items-center gap-3">
            <Store size={14} aria-hidden="true" />
            <button onClick={login} className="hover:text-blue-700 hover:underline">{user ? t('landing.nav.openPanel') : t('landing.footer.app')}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
