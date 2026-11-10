// Moedas disponíveis. O dólar americano é o padrão e vem primeiro; as demais
// cobrem os países onde o app é mais usado (Américas, Europa, Ásia, Oceania,
// Oriente Médio e África). A localidade só define a formatação dos números.
export const CURRENCIES = [
  { code: 'USD', locale: 'en-US' },
  { code: 'EUR', locale: 'de-DE' },
  { code: 'GBP', locale: 'en-GB' },
  { code: 'CAD', locale: 'en-CA' },
  { code: 'AUD', locale: 'en-AU' },
  { code: 'NZD', locale: 'en-NZ' },
  { code: 'MXN', locale: 'es-MX' },
  { code: 'BRL', locale: 'pt-BR' },
  { code: 'ARS', locale: 'es-AR' },
  { code: 'CLP', locale: 'es-CL' },
  { code: 'COP', locale: 'es-CO' },
  { code: 'PEN', locale: 'es-PE' },
  { code: 'UYU', locale: 'es-UY' },
  { code: 'PYG', locale: 'es-PY' },
  { code: 'BOB', locale: 'es-BO' },
  { code: 'VES', locale: 'es-VE' },
  { code: 'DOP', locale: 'es-DO' },
  { code: 'CRC', locale: 'es-CR' },
  { code: 'GTQ', locale: 'es-GT' },
  { code: 'HNL', locale: 'es-HN' },
  { code: 'NIO', locale: 'es-NI' },
  { code: 'PAB', locale: 'es-PA' },
  { code: 'CHF', locale: 'de-CH' },
  { code: 'SEK', locale: 'sv-SE' },
  { code: 'NOK', locale: 'nb-NO' },
  { code: 'DKK', locale: 'da-DK' },
  { code: 'PLN', locale: 'pl-PL' },
  { code: 'CZK', locale: 'cs-CZ' },
  { code: 'HUF', locale: 'hu-HU' },
  { code: 'RON', locale: 'ro-RO' },
  { code: 'TRY', locale: 'tr-TR' },
  { code: 'JPY', locale: 'ja-JP' },
  { code: 'CNY', locale: 'zh-CN' },
  { code: 'HKD', locale: 'zh-HK' },
  { code: 'TWD', locale: 'zh-TW' },
  { code: 'KRW', locale: 'ko-KR' },
  { code: 'SGD', locale: 'en-SG' },
  { code: 'INR', locale: 'en-IN' },
  { code: 'THB', locale: 'th-TH' },
  { code: 'MYR', locale: 'ms-MY' },
  { code: 'IDR', locale: 'id-ID' },
  { code: 'PHP', locale: 'en-PH' },
  { code: 'VND', locale: 'vi-VN' },
  { code: 'AED', locale: 'ar-AE' },
  { code: 'SAR', locale: 'ar-SA' },
  { code: 'QAR', locale: 'ar-QA' },
  { code: 'ILS', locale: 'he-IL' },
  { code: 'EGP', locale: 'ar-EG' },
  { code: 'MAD', locale: 'ar-MA' },
  { code: 'ZAR', locale: 'en-ZA' },
  { code: 'NGN', locale: 'en-NG' },
  { code: 'KES', locale: 'en-KE' },
  { code: 'AOA', locale: 'pt-AO' },
  { code: 'MZN', locale: 'pt-MZ' },
] as const;

export type Currency = (typeof CURRENCIES)[number]['code'];
export const DEFAULT_CURRENCY: Currency = 'USD';

export const isCurrency = (c: unknown): c is Currency => CURRENCIES.some(x => x.code === c);

const localeOf = (c: Currency) => CURRENCIES.find(x => x.code === c)?.locale ?? 'en-US';

// Opções do seletor no idioma da tela: USD primeiro, as demais em ordem alfabética
// pelo nome traduzido. Ex.: "USD — US$ · Dólar americano".
export function currencyOptions(lang: string): { code: Currency; label: string }[] {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames([lang], { type: 'currency' }); } catch { /* navegador antigo */ }
  const opts = CURRENCIES.map(({ code }) => {
    const name = names?.of(code) ?? code;
    const sym = new Intl.NumberFormat(lang, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find(p => p.type === 'currency')?.value ?? '';
    const label = sym && sym !== code ? `${code} — ${sym} · ${name}` : `${code} — ${name}`;
    return { code: code as Currency, label, name };
  });
  const [first, ...rest] = opts;
  rest.sort((a, b) => a.name.localeCompare(b.name, lang));
  return [first, ...rest].map(({ code, label }) => ({ code, label }));
}

// Moeda de formatação atual. No modo consultor ela é definida pelo restaurante
// aberto (RestaurantProvider). Só muda a exibição: nenhum valor é convertido.
const storage = typeof localStorage !== 'undefined' ? localStorage : null;
const stored = storage?.getItem('currency');
let current: Currency = isCurrency(stored) ? stored : DEFAULT_CURRENCY;

export function getCurrency(): Currency {
  return current;
}

export function setCurrencyValue(c: Currency): void {
  if (current === c) return;
  current = c;
  storage?.setItem('currency', c);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(localeOf(current), { style: 'currency', currency: current }).format(value || 0);
}

export function currencySymbol(): string {
  const parts = new Intl.NumberFormat(localeOf(current), { style: 'currency', currency: current }).formatToParts(0);
  return parts.find(p => p.type === 'currency')?.value ?? '$';
}
