export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'MXN' | 'ARS';

export const CURRENCIES: { code: Currency; label: string; locale: string }[] = [
  { code: 'BRL', label: 'R$ Real', locale: 'pt-BR' },
  { code: 'USD', label: '$ Dólar', locale: 'en-US' },
  { code: 'EUR', label: '€ Euro', locale: 'de-DE' },
  { code: 'GBP', label: '£ Libra', locale: 'en-GB' },
  { code: 'MXN', label: '$ Peso MX', locale: 'es-MX' },
  { code: 'ARS', label: '$ Peso AR', locale: 'es-AR' },
];

const localeOf = (c: Currency) => CURRENCIES.find(x => x.code === c)?.locale ?? 'pt-BR';

// Valor atual mantido em nível de módulo para que formatCurrency continue puro.
let current: Currency = (localStorage.getItem('currency') as Currency) || 'BRL';

export function getCurrency(): Currency {
  return current;
}

export function setCurrencyValue(c: Currency): void {
  current = c;
  localStorage.setItem('currency', c);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(localeOf(current), { style: 'currency', currency: current }).format(value || 0);
}

export function currencySymbol(): string {
  const parts = new Intl.NumberFormat(localeOf(current), { style: 'currency', currency: current }).formatToParts(0);
  return parts.find(p => p.type === 'currency')?.value ?? '$';
}
