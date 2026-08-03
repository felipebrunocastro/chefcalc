// Sistemas de medida. Cup, spoon, pint, quart, gallon e fl oz variam entre
// Métrico, Imperial EUA (US) e Imperial Reino Unido (UK). Valores em mL.

export type MeasurementSystem = 'metric' | 'us' | 'uk';

export const SYSTEM_VOLUME_ML: Record<MeasurementSystem, Record<string, number>> = {
  us: {
    tsp: 4.92892159375,
    tbsp: 14.78676478125,
    cup: 236.5882365,
    floz: 29.5735295625,
    pint: 473.176473,
    quart: 946.352946,
    gallon: 3785.411784,
  },
  uk: {
    tsp: 5.91938802083,
    tbsp: 17.7581640625,
    cup: 284.130625,
    floz: 28.4130625,
    pint: 568.26125,
    quart: 1136.5225,
    gallon: 4546.09,
  },
  metric: {
    tsp: 5,
    tbsp: 15,
    cup: 250,
    floz: 30,
    pint: 500,
    quart: 1000,
    gallon: 4000,
  },
};

export const SYSTEMS: { id: MeasurementSystem; labelKey: string }[] = [
  { id: 'metric', labelKey: 'metric' },
  { id: 'us', labelKey: 'us' },
  { id: 'uk', labelKey: 'uk' },
];
