import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, ChefHat, Calculator, FileDown, Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { CurrencySwitcher } from './ui/CurrencySwitcher';
import { useAuth } from '../hooks/useAuth';
import type { AppView } from '../types';

interface Props {
  current: AppView;
  onNavigate: (view: AppView) => void;
  onCurrencyChange?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { view: 'dashboard' as AppView, icon: LayoutDashboard, key: 'nav.dashboard' },
  { view: 'ingredients' as AppView, icon: Package, key: 'nav.ingredients' },
  { view: 'dish' as AppView, icon: ChefHat, key: 'nav.newDish' },
  { view: 'simulator' as AppView, icon: Calculator, key: 'nav.simulator' },
  { view: 'export' as AppView, icon: FileDown, key: 'nav.export' },
];

export function Layout({ current, onNavigate, onCurrencyChange, children }: Props) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = (view: AppView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-4">
          <button
            className="md:hidden p-1.5 text-gray-500 hover:text-gray-700 rounded-md"
            onClick={() => setMobileMenuOpen(m => !m)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-2 mr-auto">
            <ChefHat size={22} className="text-amber-500" />
            <span className="font-bold text-gray-900 text-base">ChefCalc</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ view, icon: Icon, key }) => (
              <button
                key={view}
                onClick={() => navigate(view)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  current === view
                    ? 'bg-amber-50 text-amber-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Icon size={14} />
                {t(key)}
              </button>
            ))}
          </nav>

          <CurrencySwitcher onChange={onCurrencyChange} />
          <LanguageSwitcher />
          <button
            onClick={signOut}
            title={t('auth.signOut')}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-2">
            {NAV_ITEMS.map(({ view, icon: Icon, key }) => (
              <button
                key={view}
                onClick={() => navigate(view)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                  current === view
                    ? 'bg-amber-50 text-amber-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {t(key)}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Bottom mobile nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40 flex">
        {NAV_ITEMS.map(({ view, icon: Icon, key }) => (
          <button
            key={view}
            onClick={() => navigate(view)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              current === view ? 'text-amber-500' : 'text-gray-400'
            }`}
          >
            <Icon size={18} />
            <span className="truncate max-w-[60px]">{t(key)}</span>
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
