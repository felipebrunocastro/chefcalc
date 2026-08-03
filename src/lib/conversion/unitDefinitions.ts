// Definições de unidades por categoria.
// Peso -> base grama (g). Volume -> base mililitro (mL). Comprimento -> base milímetro (mm).
// Unidades de volume marcadas como systemDependent têm o fator definido em measurementSystems.

export type Category = 'weight' | 'volume' | 'length' | 'temperature';

export interface UnitDef {
  id: string;
  category: Category;
  toBase: number;          // fator para a unidade base (ignorado se systemDependent)
  systemDependent?: boolean;
  labelKey: string;        // chave i18n (converter.units.*)
}

export const WEIGHT_UNITS: UnitDef[] = [
  { id: 'mg', category: 'weight', toBase: 0.001, labelKey: 'mg' },
  { id: 'g', category: 'weight', toBase: 1, labelKey: 'g' },
  { id: 'kg', category: 'weight', toBase: 1000, labelKey: 'kg' },
  { id: 'oz', category: 'weight', toBase: 28.349523125, labelKey: 'oz' },
  { id: 'lb', category: 'weight', toBase: 453.59237, labelKey: 'lb' },
];

export const VOLUME_UNITS: UnitDef[] = [
  { id: 'ml', category: 'volume', toBase: 1, labelKey: 'ml' },
  { id: 'L', category: 'volume', toBase: 1000, labelKey: 'L' },
  { id: 'tsp', category: 'volume', toBase: 0, systemDependent: true, labelKey: 'tsp' },
  { id: 'tbsp', category: 'volume', toBase: 0, systemDependent: true, labelKey: 'tbsp' },
  { id: 'dessertspoon', category: 'volume', toBase: 10, labelKey: 'dessertspoon' },
  { id: 'coffeespoon', category: 'volume', toBase: 2, labelKey: 'coffeespoon' },
  { id: 'cup', category: 'volume', toBase: 0, systemDependent: true, labelKey: 'cup' },
  { id: 'floz', category: 'volume', toBase: 0, systemDependent: true, labelKey: 'floz' },
  { id: 'pint', category: 'volume', toBase: 0, systemDependent: true, labelKey: 'pint' },
  { id: 'quart', category: 'volume', toBase: 0, systemDependent: true, labelKey: 'quart' },
  { id: 'gallon', category: 'volume', toBase: 0, systemDependent: true, labelKey: 'gallon' },
];

export const LENGTH_UNITS: UnitDef[] = [
  { id: 'mm', category: 'length', toBase: 1, labelKey: 'mm' },
  { id: 'cm', category: 'length', toBase: 10, labelKey: 'cm' },
  { id: 'm', category: 'length', toBase: 1000, labelKey: 'm' },
  { id: 'in', category: 'length', toBase: 25.4, labelKey: 'in' },
];

export const TEMPERATURE_UNITS: UnitDef[] = [
  { id: 'C', category: 'temperature', toBase: 1, labelKey: 'C' },
  { id: 'F', category: 'temperature', toBase: 1, labelKey: 'F' },
  { id: 'K', category: 'temperature', toBase: 1, labelKey: 'K' },
];

export const UNITS_BY_CATEGORY: Record<Category, UnitDef[]> = {
  weight: WEIGHT_UNITS,
  volume: VOLUME_UNITS,
  length: LENGTH_UNITS,
  temperature: TEMPERATURE_UNITS,
};

export const ALL_UNITS: UnitDef[] = [
  ...WEIGHT_UNITS, ...VOLUME_UNITS, ...LENGTH_UNITS, ...TEMPERATURE_UNITS,
];

export function findUnit(id: string): UnitDef | undefined {
  return ALL_UNITS.find(u => u.id === id);
}
