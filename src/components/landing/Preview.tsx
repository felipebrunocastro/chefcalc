import { useTranslation } from 'react-i18next';
import { Target, TrendingUp, Wallet, Plug, FileSpreadsheet, Clock } from 'lucide-react';

export type PreviewKind = 'overview' | 'sheets' | 'ingredients' | 'converter' | 'finance' | 'delivery' | 'consulting';

const usd = (v: number, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(v);

// Prévia do produto com dados de exemplo (claramente identificados).
export function Preview({ kind }: { kind: PreviewKind }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  const m = (v: number) => usd(v, locale);
  return (
    <div className="rounded-2xl bg-white shadow-xl shadow-blue-900/10 border border-blue-100 overflow-hidden text-left">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white">
        <span className="w-6 h-6 rounded-md bg-blue-500 text-[10px] font-bold flex items-center justify-center" aria-hidden="true">BE</span>
        <span className="text-sm font-semibold truncate">{t('landing.sampleRestaurant')}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide bg-amber-300 text-amber-950 rounded px-1.5 py-0.5">{t('landing.sample')}</span>
      </div>
      <div className="p-4 space-y-3 text-sm">
        {kind === 'overview' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[[Target, t('landing.preview.breakeven'), m(16666.67)], [TrendingUp, t('landing.preview.goal'), m(19230.77)], [Wallet, t('landing.preview.sales'), m(14250)]].map(([Icon, l, v], i) => {
                const I = Icon as typeof Target;
                return (
                  <div key={i} className={`rounded-xl bg-blue-50 p-2 min-w-0 ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
                    <div className="text-[10px] leading-tight text-slate-500 flex items-start gap-1 min-h-[1.6rem]"><I size={11} className="text-blue-600 shrink-0 mt-px" aria-hidden="true" /> <span>{l as string}</span></div>
                    <div className="font-mono font-bold text-navy-900 text-[12px] sm:text-[13px] whitespace-nowrap tracking-tight">{v as string}</div>
                  </div>
                );
              })}
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-600 mb-1"><span>{t('landing.preview.progress')}</span><span className="font-mono">74%</span></div>
              <div className="h-2.5 bg-blue-100 rounded-full"><div className="h-2.5 bg-blue-600 rounded-full w-[74%]" /></div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 mb-1">{t('landing.preview.channels')}</div>
              {[[t('landing.preview.counter'), 7600, 'w-[100%]'], [t('landing.preview.dinein'), 3900, 'w-[51%]'], ['DoorDash', 1850, 'w-[24%]'], ['Uber Eats', 900, 'w-[12%]']].map(([l, v, w]) => (
                <div key={l as string} className="flex items-center gap-2 py-0.5">
                  <span className="w-[4.5rem] text-xs text-slate-700 truncate">{l as string}</span>
                  <span className="flex-1 min-w-[2rem] h-2 bg-slate-100 rounded"><span className={`block h-2 rounded bg-sky-400 ${w}`} /></span>
                  <span className="w-24 text-right font-mono text-[11px] sm:text-xs whitespace-nowrap">{m(v as number)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {kind === 'sheets' && (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 font-medium">{t('landing.features.sheetCols.dish')}</th><th className="py-1 font-medium text-right">{t('landing.features.sheetCols.cost')}</th><th className="py-1 font-medium text-right">{t('landing.features.sheetCols.price')}</th><th className="py-1 font-medium text-right">{t('landing.features.sheetCols.fc')}</th></tr></thead>
            <tbody>
              {[['Classic burger', 2.34, 12, '19.5%'], ['Fish tacos', 3.1, 13.5, '23.0%'], ['Mofongo', 2.85, 14, '20.4%'], ['Açaí bowl', 1.95, 9, '21.7%']].map(([d, c, p, f]) => (
                <tr key={d as string} className="border-t border-slate-100"><td className="py-1.5">{d}</td><td className="py-1.5 text-right font-mono">{m(c as number)}</td><td className="py-1.5 text-right font-mono">{m(p as number)}</td><td className="py-1.5 text-right font-mono text-emerald-700">{f}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {kind === 'ingredients' && (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 font-medium">{t('landing.features.ingCols.item')}</th><th className="py-1 font-medium">{t('landing.features.ingCols.bought')}</th><th className="py-1 font-medium">{t('landing.features.ingCols.usage')}</th><th className="py-1 font-medium text-right">{t('landing.features.ingCols.cost')}</th></tr></thead>
            <tbody>
              {[['Ground beef', `10 lb · ${m(42)}`, '150 g', m(1.39)], ['Brioche buns', `12 un · ${m(6)}`, '1 un', m(0.5)], ['Cheddar', `5 lb · ${m(24.5)}`, '20 g', m(0.22)], ['Fries', `5 lb · ${m(9.9)}`, '120 g', m(0.52)]].map(r => (
                <tr key={r[0]} className="border-t border-slate-100">{r.map((c, i) => <td key={i} className={`py-1.5 ${i === 3 ? 'text-right font-mono' : ''}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
        {kind === 'converter' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-blue-50 p-3"><div className="text-[10px] text-slate-500">{t('landing.features.conv.from')}</div><div className="font-mono font-bold text-navy-900 text-lg">10 lb</div></div>
              <span className="text-blue-500 font-bold" aria-hidden="true">→</span>
              <div className="flex-1 rounded-xl bg-navy-900 text-white p-3"><div className="text-[10px] text-blue-200">{t('landing.features.conv.to')}</div><div className="font-mono font-bold text-lg">4,535.9 g</div></div>
            </div>
            <p className="text-xs text-slate-600">{t('landing.features.conv.portions', { n: 30, g: 150 })}</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[['1 cup', '236.6 ml'], ['1 fl oz', '29.6 ml'], ['1 gal', '3.79 L']].map(([a, b]) => <div key={a} className="rounded-lg border border-blue-100 py-1.5"><div className="font-semibold">{a}</div><div className="text-slate-500 font-mono">{b}</div></div>)}
            </div>
          </div>
        )}
        {kind === 'finance' && (
          <div className="space-y-3">
            {[[t('landing.features.fin.fixed'), 10000, 9600], [t('landing.features.fin.variable'), 6600, 7100]].map(([l, e, a]) => (
              <div key={l as string}>
                <div className="text-xs font-medium text-slate-700 mb-1">{l}</div>
                <div className="flex items-center gap-2 text-[11px]"><span className="w-16 text-slate-500">{t('landing.features.fin.estimated')}</span><span className="flex-1 h-2.5 bg-slate-100 rounded"><span className="block h-2.5 rounded bg-blue-200 border border-blue-400" style={{ width: `${((e as number) / 10000) * 100}%` }} /></span><span className="w-20 text-right font-mono">{m(e as number)}</span></div>
                <div className="flex items-center gap-2 text-[11px] mt-1"><span className="w-16 text-slate-500">{t('landing.features.fin.actual')}</span><span className="flex-1 h-2.5 bg-slate-100 rounded"><span className="block h-2.5 rounded bg-navy-900" style={{ width: `${((a as number) / 10000) * 100}%` }} /></span><span className="w-20 text-right font-mono">{m(a as number)}</span></div>
              </div>
            ))}
            <div className="rounded-xl bg-blue-50 p-2.5 flex justify-between text-xs"><span>{t('landing.preview.breakeven')}</span><b className="font-mono">{m(16666.67)}</b></div>
          </div>
        )}
        {kind === 'delivery' && (
          <div className="space-y-2">
            <table className="w-full text-xs">
              <tbody>
                {[['Square', t('landing.features.connection.direct'), Plug, 'text-emerald-700'], ['DoorDash', t('landing.features.connection.csv'), FileSpreadsheet, 'text-blue-700'], ['Uber Eats', t('landing.features.connection.csv'), FileSpreadsheet, 'text-blue-700'], ['Grubhub', t('landing.features.connection.csv'), FileSpreadsheet, 'text-blue-700']].map(([p, s, Icon, c]) => {
                  const I = Icon as typeof Plug;
                  return <tr key={p as string} className="border-t border-slate-100"><td className="py-1.5 font-medium">{p as string}</td><td className={`py-1.5 ${c}`}><span className="inline-flex items-center gap-1"><I size={12} aria-hidden="true" /> {s as string}</span></td></tr>;
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 flex items-center gap-1"><Clock size={11} aria-hidden="true" /> {t('landing.features.connection.dev')}: DoorDash · Uber Eats · Grubhub API</p>
            <p className="text-[11px] text-slate-500">{t('landing.features.connection.generic')}</p>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-blue-50 py-1.5"><div className="text-slate-500">DoorDash</div><b className="font-mono">{m(1850)}</b></div>
              <div className="rounded-lg bg-blue-50 py-1.5"><div className="text-slate-500">{t('integ.col.rate', 'Taxa efetiva')}</div><b className="font-mono">23.2%</b></div>
              <div className="rounded-lg bg-blue-50 py-1.5"><div className="text-slate-500">{t('home.payouts', 'repasses')}</div><b className="font-mono">{m(1421)}</b></div>
            </div>
          </div>
        )}
        {kind === 'consulting' && (
          <div className="grid grid-cols-2 gap-2">
            {[['Bistrô Azul', 'bg-cyan-700', 14], ['Taco Loco', 'bg-red-600', 9], ['Café Brisa', 'bg-amber-700', 22], ['La Parrilla', 'bg-emerald-700', 11]].map(([n, c, k]) => (
              <div key={n as string} className="rounded-xl border border-blue-100 p-2.5 flex items-center gap-2 min-w-0">
                <span className={`w-8 h-8 rounded-lg ${c} text-white text-[10px] font-bold flex items-center justify-center shrink-0`} aria-hidden="true">{(n as string).split(' ').map(w => w[0]).join('')}</span>
                <span className="min-w-0"><span className="block text-xs font-semibold truncate">{n as string}</span><span className="block text-[10px] text-slate-500">{t('landing.features.consult.sheets', { n: k })}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
