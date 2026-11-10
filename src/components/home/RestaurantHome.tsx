import { useMemo, useState } from 'react';
import { ShareDialog } from '../restaurants/ShareDialog';
import { useTranslation } from 'react-i18next';
import { Plus, Package, Wallet, ClipboardList, Receipt, Truck, Calculator, Share2, Target, TrendingUp, Store, ChevronRight } from 'lucide-react';
import { Mascot } from '../ui/Mascot';
import { basisFromBudget, basisFromMonth, computeTargets, DEFAULT_SCENARIOS } from '../../utils/breakeven';
import { profileCompletion } from '../../utils/profile';
import { useRestaurant } from '../../hooks/useRestaurant';
import { useDishes } from '../../hooks/useDishes';
import { formatCurrency } from '../../lib/currency';
import { actualTotals, budgetTotals, currentPeriod, deliveryTotals, formatPeriod, monthState, monthSalesTotal } from '../../utils/finance';
import { useFinanceMonths, StateBadge } from '../finance/FinancePage';
import { RestaurantLogo } from '../restaurants/RestaurantLogo';
import type { AppView } from '../../types';

const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const;

export function RestaurantHome({ onNavigate }: { onNavigate: (v: AppView, dishId?: string) => void }) {
  const { t, i18n } = useTranslation();
  const { current: restaurant } = useRestaurant();
  const { dishes, loading } = useDishes();
  const { months } = useFinanceMonths(restaurant?.id);
  const locale = LOCALES[(i18n.language as keyof typeof LOCALES)] ?? 'pt-BR';
  const [sharing, setSharing] = useState(false);

  const period = currentPeriod();
  const month = months.find(m => m.period === period);
  const state = monthState(month);
  const estimate = budgetTotals(month?.estimateSnapshot ?? restaurant?.budget ?? []);
  const actual = actualTotals(month?.entries ?? []);
  const delivery = deliveryTotals(month?.entries ?? []);
  const monthLabel = formatPeriod(period, locale);

  const bars = useMemo(() => [
    { key: 'fixed', label: t('finance.fixed'), est: estimate.fixed, act: actual.fixed },
    { key: 'variable', label: t('finance.variable'), est: estimate.variable, act: actual.variable },
    { key: 'total', label: t('finance.total'), est: estimate.total, act: actual.total },
  ], [estimate.fixed, estimate.variable, estimate.total, actual.fixed, actual.variable, actual.total, t]);

  if (!restaurant) return null;
  const goals = restaurant.goals ?? {};
  const closed = months.filter(m => m.status === 'closed');
  const basis = (goals.basis ?? 'budget') === 'month'
    ? basisFromMonth(months.find(m => m.period === (goals.basisPeriod ?? closed[0]?.period)), goals)
    : basisFromBudget(restaurant.budget, goals, restaurant.profile);
  const targets = computeTargets(basis, restaurant.profile, goals);
  const goalPct = goals.dashboardScenario ?? (goals.scenarios?.length ? goals.scenarios : DEFAULT_SCENARIOS)[0];
  const goalResult = targets.byMargin(goalPct);
  const sales = monthSalesTotal(month);
  const completion = profileCompletion(restaurant);
  const targetText = (r: typeof goalResult) =>
    r.status === 'ok' ? formatCurrency(r.monthly!) : r.status === 'infeasible' ? t('goals.infeasible') : r.status === 'noBreakeven' ? t('goals.noBreakeven') : t('home.goalsMissing');
  const remaining = (r: typeof goalResult) => {
    if (r.status !== 'ok' || !sales.informed) return null;
    const diff = r.monthly! - sales.total;
    return diff <= 0 ? <span className="text-emerald-700 font-semibold">{t('home.reached')}</span> : <span className="text-slate-600">{t('home.remaining', { v: formatCurrency(diff) })}</span>;
  };
  const max = Math.max(1, ...bars.flatMap(b => [b.est, b.act]));
  const noActual = state === 'empty';

  const shortcuts = [
    { label: t('nav.newDish'), icon: Plus, onClick: () => onNavigate('dish'), primary: true },
    { label: t('nav.sheets'), icon: ClipboardList, onClick: () => onNavigate('dashboard') },
    { label: t('nav.ingredients'), icon: Package, onClick: () => onNavigate('ingredients') },
    { label: t('nav.finance'), icon: Wallet, onClick: () => onNavigate('finance') },
    { label: t('nav.simulator'), icon: Calculator, onClick: () => onNavigate('simulator') },
    { label: t('nav.profile'), icon: Store, onClick: () => onNavigate('profile') },
  ];

  const kpis = [
    { label: t('home.kpiSheets'), value: loading ? '…' : String(dishes.length), icon: ClipboardList },
    { label: t('home.kpiEstimated'), value: formatCurrency(estimate.total), icon: Receipt },
    { label: t('home.kpiActual', { month: monthLabel }), value: noActual ? '—' : formatCurrency(actual.total), icon: Wallet, badge: true },
    { label: t('home.kpiDelivery', { month: monthLabel }), value: noActual ? '—' : formatCurrency(delivery.total), icon: Truck },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <section className="card overflow-hidden bg-gradient-to-br from-white to-blue-50">
        {restaurant.profile.coverPhoto && <img src={restaurant.profile.coverPhoto} alt="" className="w-full h-32 md:h-44 object-cover" />}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <RestaurantLogo restaurant={restaurant} size={72} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-navy-900 truncate">{restaurant.name}</h1>
          <p className="text-sm text-slate-500">{t('restaurants.sheets', { count: dishes.length })} · {restaurant.currency}</p>
          {restaurant.profile.shortDescription && <p className="text-sm text-slate-600 mt-1">{restaurant.profile.shortDescription}</p>}
        </div>
        {restaurant.role === 'owner' && (
          <button onClick={() => setSharing(true)} className="btn-secondary self-start sm:self-center"><Share2 size={15} /> {t('share.button')}</button>
        )}
      </div>
      </section>
      {completion < 100 && (
        <button onClick={() => onNavigate('profile')} className="card w-full p-4 flex items-center gap-4 text-left hover:border-blue-300">
          <Mascot size={64} decorative className="shrink-0 -my-2" />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-navy-900">{t('home.profileCta')}</span>
            <span className="block text-xs text-slate-500">{t('home.profileCtaHint')}</span>
            <span className="mt-1.5 block h-1.5 bg-blue-100 rounded-full max-w-xs"><span className="block h-1.5 bg-blue-600 rounded-full" style={{ width: `${completion}%` }} /></span>
          </span>
          <span className="text-sm font-semibold text-blue-700 shrink-0">{t('profile.completion', { pct: completion })}</span>
          <ChevronRight size={18} className="text-blue-400" />
        </button>
      )}
      {sharing && <ShareDialog restaurant={restaurant} onClose={() => setSharing(false)} />}

      <section aria-label={t('home.shortcuts')} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {shortcuts.map(s => (
          <button key={s.label} onClick={s.onClick} className={`${s.primary ? 'btn-primary' : 'btn-secondary'} !py-3 flex-col sm:flex-row`}>
            <s.icon size={18} aria-hidden="true" /> {s.label}
          </button>
        ))}
      </section>

      <section className="grid sm:grid-cols-3 gap-3" aria-label={t('goals.title')}>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Target size={14} className="text-blue-600" aria-hidden="true" /> {t('home.kpiBreakeven')}</div>
          <div className="text-xl font-bold text-navy-900 font-mono">{targetText(targets.breakeven)}</div>
          <div className="text-xs mt-1">{remaining(targets.breakeven)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><TrendingUp size={14} className="text-blue-600" aria-hidden="true" /> {t('home.kpiGoal', { pct: goalPct })}</div>
          <div className="text-xl font-bold text-navy-900 font-mono">{targetText(goalResult)}</div>
          <div className="text-xs mt-1">{remaining(goalResult)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Wallet size={14} className="text-blue-600" aria-hidden="true" /> {t('home.kpiSales', { month: monthLabel })}</div>
          <div className="text-xl font-bold text-navy-900 font-mono">{sales.informed ? formatCurrency(sales.total) : <span className="text-base text-slate-400 font-sans font-medium">{t('home.salesNotInformed')}</span>}</div>
          <div className="mt-1"><StateBadge state={state} /></div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <k.icon size={14} className="text-blue-600" aria-hidden="true" /> <span>{k.label}</span>
            </div>
            <div className="text-xl font-bold text-navy-900 font-mono">{k.value}</div>
            {k.badge && <div className="mt-1"><StateBadge state={state} /></div>}
          </div>
        ))}
      </section>

      <section className="card p-4 md:p-5" aria-labelledby="chart-h">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 id="chart-h" className="font-semibold text-navy-900">{t('home.chartTitle', { month: monthLabel })}</h2>
          <StateBadge state={state} />
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-400" aria-hidden="true" /> {t('home.estimated')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-navy-900" aria-hidden="true" /> {t('home.actual')}</span>
          </div>
        </div>
        {estimate.total === 0 && (
          <p className="text-sm text-slate-500 mb-3">{t('home.noBudget')} <button onClick={() => onNavigate('finance')} className="text-blue-700 hover:underline">{t('home.openFinance')}</button></p>
        )}
        <div className="space-y-4" role="list">
          {bars.map(b => (
            <div key={b.key} role="listitem" className="grid grid-cols-[5.5rem_1fr] gap-3 items-center">
              <span className="text-sm font-medium text-slate-700">{b.label}</span>
              <div className="space-y-1">
                <Bar pct={(b.est / max) * 100} cls="bg-blue-200 border border-blue-400" text={`${t('home.estimated')}: ${formatCurrency(b.est)}`} />
                <Bar pct={noActual ? 0 : (b.act / max) * 100} cls="bg-navy-900" text={`${t('home.actual')}: ${noActual ? t('finance.stateEmpty') : formatCurrency(b.act)}`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Bar({ pct, cls, text }: { pct: number; cls: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-4 bg-slate-100 rounded" aria-hidden="true">
        <div className={`h-4 rounded ${cls}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, transition: 'width .3s' }} />
      </div>
      <span className="text-xs font-mono text-slate-700 w-44 text-right shrink-0">{text}</span>
    </div>
  );
}
