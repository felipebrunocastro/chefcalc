import { CURRENCIES, getCurrency, setCurrencyValue, type Currency } from '../../lib/currency';

interface Props {
  onChange?: () => void;
}

// Ao trocar a moeda, dispara um re-render global via callback (App força atualização).
export function CurrencySwitcher({ onChange }: Props) {
  const current = getCurrency();

  return (
    <select
      value={current}
      onChange={e => { setCurrencyValue(e.target.value as Currency); onChange?.(); }}
      className="text-xs font-medium text-gray-500 bg-transparent border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
      title="Moeda"
    >
      {CURRENCIES.map(c => (
        <option key={c.code} value={c.code}>{c.code}</option>
      ))}
    </select>
  );
}
