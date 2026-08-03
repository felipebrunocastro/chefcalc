// Motor de conversão. Converte dentro da mesma categoria (peso/volume/comprimento/
// temperatura) e também peso <-> volume usando a densidade de um ingrediente.
import { findUnit, type Category } from './unitDefinitions';
import { SYSTEM_VOLUME_ML, type MeasurementSystem } from './measurementSystems';

// mL de uma unidade de volume no sistema escolhido.
export function volumeToMl(unitId: string, system: MeasurementSystem): number {
  const u = findUnit(unitId);
  if (!u || u.category !== 'volume') return NaN;
  if (u.systemDependent) return SYSTEM_VOLUME_ML[system][unitId] ?? NaN;
  return u.toBase;
}

// Fator para a base da categoria (g, mm) — não usar para volume/temperatura.
function toBase(unitId: string): number {
  const u = findUnit(unitId);
  return u ? u.toBase : NaN;
}

function convertTemperature(value: number, from: string, to: string): number {
  // normaliza para Celsius
  let c: number;
  if (from === 'C') c = value;
  else if (from === 'F') c = (value - 32) * (5 / 9);
  else c = value - 273.15; // K
  if (to === 'C') return c;
  if (to === 'F') return c * (9 / 5) + 32;
  return c + 273.15; // K
}

export interface ConvertParams {
  value: number;
  from: string;
  to: string;
  system: MeasurementSystem;
  density?: number; // g/mL — obrigatório para cruzar peso <-> volume
}

// Retorna o valor convertido ou NaN se a conversão não for possível.
export function convert({ value, from, to, system, density }: ConvertParams): number {
  const uf = findUnit(from);
  const ut = findUnit(to);
  if (!uf || !ut || Number.isNaN(value)) return NaN;

  if (uf.category === 'temperature' || ut.category === 'temperature') {
    if (uf.category !== 'temperature' || ut.category !== 'temperature') return NaN;
    return convertTemperature(value, from, to);
  }

  // mesma categoria
  if (uf.category === ut.category) {
    if (uf.category === 'volume') {
      const ml = value * volumeToMl(from, system);
      return ml / volumeToMl(to, system);
    }
    return (value * toBase(from)) / toBase(to);
  }

  // cruzando peso <-> volume via densidade
  const crossing =
    (uf.category === 'weight' && ut.category === 'volume') ||
    (uf.category === 'volume' && ut.category === 'weight');
  if (crossing) {
    if (!density || density <= 0) return NaN;
    if (uf.category === 'weight') {
      const grams = value * toBase(from);       // -> g
      const ml = grams / density;               // g -> mL
      return ml / volumeToMl(to, system);       // mL -> unidade destino
    } else {
      const ml = value * volumeToMl(from, system); // -> mL
      const grams = ml * density;                  // mL -> g
      return grams / toBase(to);                   // g -> unidade destino
    }
  }

  return NaN; // ex.: comprimento <-> peso não faz sentido
}

// Formata o resultado com precisão adequada (evita ruído de ponto flutuante).
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  let decimals: number;
  if (abs === 0) decimals = 0;
  else if (abs < 0.01) decimals = 5;
  else if (abs < 1) decimals = 4;
  else if (abs < 100) decimals = 2;
  else decimals = 1;
  return value.toFixed(decimals).replace(/\.?0+$/, '') || '0';
}

export function categoryOf(unitId: string): Category | null {
  const u = findUnit(unitId);
  return u ? u.category : null;
}
