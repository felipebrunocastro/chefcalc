import { describe, it, expect } from 'vitest';
import { calcDish } from '../utils/calculations';
import type { Dish, Ingredient } from '../types';

const ing = (id: string, preco: number): Ingredient => ({
  id, nome: { pt: 'Carne', en: 'Beef', es: 'Carne' }, unidadeCompra: 'kg', precoCompra: preco, fatorCorrecao: 1, createdAt: 0,
});
const dish = (over: Partial<Dish> = {}): Dish => ({
  id: 'd1', nome: { pt: 'Burger', en: 'Burger', es: 'Burger' }, categoria: 'Lanches', rendimentoPorcoes: 1,
  itens: [{ ingredienteId: 'beef', quantidadeUsada: 200, unidade: 'g' }], etapas: [],
  custoMaoObra: 0, despesasFixasPct: 0, margemLucroPct: 100, modeloPrecificacao: 'markup', createdAt: 0, updatedAt: 0, ...over,
});

describe('calcDish', () => {
  it('mesmo insumo com preços diferentes por restaurante gera custos diferentes', () => {
    const a = calcDish(dish(), [ing('beef', 10)]); // restaurante A: 10/kg
    const b = calcDish(dish(), [ing('beef', 15)]); // restaurante B: 15/kg
    expect(a.custoTotalPorcao).toBeCloseTo(2);
    expect(b.custoTotalPorcao).toBeCloseTo(3);
  });

  it('markup sobre o custo: custo 2.34 e preço 12 → 412.8%', () => {
    const r = calcDish(dish({ precoVendaManual: 12 }), [ing('beef', 11.7)]);
    expect(r.custoTotalPorcao).toBeCloseTo(2.34);
    expect(r.markupPct).toBeCloseTo(412.82, 1);
    expect(r.foodCostDisponivel).toBe(true);
    expect(r.cmvPct).toBeCloseTo(19.5, 1);
  });

  it('insumo de outro restaurante/ausente marca custo incompleto e não calcula food cost', () => {
    const r = calcDish(dish(), [ing('outro', 10)]);
    expect(r.custoIncompleto).toBe(true);
    expect(r.foodCostDisponivel).toBe(false);
    expect(r.cmvPct).toBe(0);
  });

  it('insumo sem preço marca custo incompleto', () => {
    expect(calcDish(dish(), [ing('beef', 0)]).custoIncompleto).toBe(true);
  });

  it('food cost exige preço > 0', () => {
    const r = calcDish(dish({ margemLucroPct: 0 }), [ing('beef', 10)]);
    expect(r.foodCostDisponivel).toBe(true);
    const z = calcDish(dish({ itens: [] }), []);
    expect(z.foodCostDisponivel).toBe(false);
  });
});
