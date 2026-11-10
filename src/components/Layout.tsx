import { useTranslation } from 'react-i18next';
import { Store, LayoutDashboard, Package, ShoppingCart, ClipboardList, Calculator, Scale, Printer, Menu, X, LogOut, Wallet, ArrowLeftRight, ChefHat } from 'lucide-react';
import { useState } from 'react';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { useAuth } from '../hooks/useAuth';
import { useRestaurant } from '../hooks/useRestaurant';
import { RestaurantLogo } from './restaurants/RestaurantLogo';
import type { AppView, RestaurantRole } from '../types';

interface Props {
  current: AppView;
  onNavigate: (view: AppView) => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { view: 'home' as AppView, icon: LayoutDashboard, key: 'nav.home' },
  { view: 'dashboard' as AppView, icon: ClipboardList, key: 'nav.sheets' },
  { view: 'ingredients' as AppView, icon: Package, key: 'nav.ingredients' },
  { view: 'finance' as AppView, icon: Wallet, key: 'nav.finance' },
  { view: 'shopping' as AppView, icon: ShoppingCart, key: 'shopping.navShort' },
  { view: 'simulator' as AppView, icon: Calculator, key: 'nav.simulator' },
  { view: 'export' as AppView, icon: Printer, key: 'nav.export' },
  { view: 'converter' as AppView, icon: Scale, key: 'converter.navShort' },
  { view: 'profile' as AppView, icon: Store, key: 'nav.profile' },
];
// Acesso compartilhado vê só o que o papel permite.
const ALLOWED: Record<RestaurantRole, AppView[] | null> = {
  owner: null,
  viewer: ['dashboard'],
  finance: ['dashboard', 'finance'],
};
export function allowedViews(role: RestaurantRole): AppView[] | null { return ALLOWED[role]; }

export function Layout({ current, onNavigate, children }: Props) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { current: restaurant, select } = useRestaurant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = (view: AppView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  const isActive = (v: AppView) => current === v || (v === 'dashboard' && (current === 'dish' || current === 'sheet'));
  const allowed = restaurant ? ALLOWED[restaurant.role] : null;
  const navItems = allowed ? NAV_ITEMS.filter(i => allowed.includes(i.view)) : NAV_ITEMS;
  const mobileBar = navItems.slice(0, 4);
  const showMenu = navItems.length > 4;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-3 md:px-4 flex items-center h-14 gap-2 md:gap-3">
          {restaurant && showMenu && (
            <button
              className="lg:hidden p-2 text-blue-100 hover:bg-navy-800 rounded-lg"
              onClick={() => setMobileMenuOpen(m => !m)}
              aria-expanded={mobileMenuOpen}
              aria-label={t('nav.menu')}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}

          <button onClick={() => select(null)} className={`${restaurant ? 'hidden sm:flex' : 'flex'} items-center gap-2 rounded-lg px-1 py-1 hover:bg-navy-800`} title={t('nav.restaurants')}>
            <ChefHat size={22} className="text-blue-300" />
            <span className="font-bold text-base hidden sm:inline">ChefCalc</span>
          </button>

          {restaurant && (
            <div className="flex items-center gap-2 min-w-0 sm:pl-2 sm:ml-1 sm:border-l border-navy-700">
              <RestaurantLogo restaurant={restaurant} size={30} className="!rounded-lg" />
              <span className="font-semibold text-sm truncate min-w-[3.5rem] max-w-[10rem] sm:max-w-[16rem]" title={restaurant.name}>{restaurant.name}</span>
              {restaurant.role !== 'owner' && (
                <span className="hidden sm:inline text-[11px] font-semibold bg-blue-600/30 text-blue-100 rounded-md px-2 py-0.5 shrink-0">{t(`roles.${restaurant.role}`)}</span>
              )}
              <button
                onClick={() => select(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-100 bg-navy-800 hover:bg-navy-700 rounded-md px-2 py-1 shrink-0"
              >
                <ArrowLeftRight size={13} /> <span className="hidden sm:inline">{t('nav.switchClient')}</span>
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <button onClick={signOut} title={t('auth.signOut')} aria-label={t('auth.signOut')} className="p-2 text-blue-200 hover:text-white hover:bg-navy-800 rounded-lg">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {restaurant && (
          <nav className="hidden lg:block bg-navy-950/40 border-t border-navy-800" aria-label={t('nav.menu')}>
            <div className="max-w-7xl mx-auto px-4 flex gap-1 py-1.5 overflow-x-auto">
              {navItems.map(({ view, icon: Icon, key }) => (
                <button
                  key={view}
                  onClick={() => navigate(view)}
                  aria-current={isActive(view) ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                    isActive(view) ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-navy-800 hover:text-white'
                  }`}
                >
                  <Icon size={15} /> {t(key)}
                </button>
              ))}
            </div>
          </nav>
        )}

        {restaurant && mobileMenuOpen && (
          <nav className="lg:hidden border-t border-navy-800 bg-navy-900 px-3 py-2" aria-label={t('nav.menu')}>
            {navItems.map(({ view, icon: Icon, key }) => (
              <button
                key={view}
                onClick={() => navigate(view)}
                aria-current={isActive(view) ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 ${
                  isActive(view) ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-navy-800'
                }`}
              >
                <Icon size={16} /> {t(key)}
              </button>
            ))}
          </nav>
        )}
      </header>

      {restaurant && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-navy-900 z-40 flex pb-[env(safe-area-inset-bottom)]" aria-label={t('nav.menu')}>
          {mobileBar.map(({ view, icon: Icon, key }) => (
            <button
              key={view}
              onClick={() => navigate(view)}
              aria-current={isActive(view) ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive(view) ? 'text-white bg-navy-800' : 'text-blue-200'
              }`}
            >
              <Icon size={19} />
              <span className="truncate max-w-[72px]">{t(key)}</span>
            </button>
          ))}
          {showMenu && <button onClick={() => setMobileMenuOpen(true)} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-blue-200">
            <Menu size={19} /><span>{t('nav.menu')}</span>
          </button>}
        </nav>
      )}

      <main className={`flex-1 ${restaurant ? 'pb-20 lg:pb-0' : ''}`}>
        {children}
      </main>
    </div>
  );
}
