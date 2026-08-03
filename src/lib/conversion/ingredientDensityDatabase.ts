// Banco de densidades culinárias reais (g/mL), baseado em pesos de referência
// de xícara padrão (King Arthur / tabelas culinárias). Permite converter
// peso <-> volume de forma fiel para cada ingrediente.

export interface DensityIngredient {
  id: string;
  nome: { pt: string; en: string; es: string };
  density: number; // g por mL
}

export const DENSITY_DB: DensityIngredient[] = [
  // Farinhas
  { id: 'flour_ap', nome: { pt: 'Farinha de trigo', en: 'All-purpose flour', es: 'Harina de trigo' }, density: 0.53 },
  { id: 'flour_cake', nome: { pt: 'Farinha para bolo', en: 'Cake flour', es: 'Harina para pastel' }, density: 0.48 },
  { id: 'flour_whole', nome: { pt: 'Farinha integral', en: 'Whole wheat flour', es: 'Harina integral' }, density: 0.51 },
  // Açúcares
  { id: 'sugar_white', nome: { pt: 'Açúcar refinado', en: 'Granulated sugar', es: 'Azúcar refinada' }, density: 0.85 },
  { id: 'sugar_crystal', nome: { pt: 'Açúcar cristal', en: 'Coarse (crystal) sugar', es: 'Azúcar cristal' }, density: 0.85 },
  { id: 'sugar_brown', nome: { pt: 'Açúcar mascavo', en: 'Brown sugar (packed)', es: 'Azúcar moreno' }, density: 0.93 },
  { id: 'sugar_powder', nome: { pt: 'Açúcar de confeiteiro', en: 'Powdered sugar', es: 'Azúcar glas' }, density: 0.51 },
  // Gorduras
  { id: 'butter', nome: { pt: 'Manteiga', en: 'Butter', es: 'Mantequilla' }, density: 0.96 },
  { id: 'margarine', nome: { pt: 'Margarina', en: 'Margarine', es: 'Margarina' }, density: 0.96 },
  { id: 'oil', nome: { pt: 'Óleo vegetal', en: 'Vegetable oil', es: 'Aceite vegetal' }, density: 0.92 },
  { id: 'olive_oil', nome: { pt: 'Azeite', en: 'Olive oil', es: 'Aceite de oliva' }, density: 0.915 },
  // Líquidos
  { id: 'water', nome: { pt: 'Água', en: 'Water', es: 'Agua' }, density: 1.0 },
  { id: 'milk', nome: { pt: 'Leite', en: 'Milk', es: 'Leche' }, density: 1.03 },
  { id: 'cream', nome: { pt: 'Creme de leite', en: 'Heavy cream', es: 'Crema de leche' }, density: 1.0 },
  { id: 'honey', nome: { pt: 'Mel', en: 'Honey', es: 'Miel' }, density: 1.42 },
  { id: 'glucose', nome: { pt: 'Glucose', en: 'Glucose', es: 'Glucosa' }, density: 1.43 },
  { id: 'corn_syrup', nome: { pt: 'Xarope de milho', en: 'Corn syrup', es: 'Jarabe de maíz' }, density: 1.38 },
  // Chocolate / cacau
  { id: 'cocoa', nome: { pt: 'Chocolate em pó', en: 'Cocoa powder', es: 'Chocolate en polvo' }, density: 0.42 },
  { id: 'cacao', nome: { pt: 'Cacau em pó', en: 'Unsweetened cacao', es: 'Cacao en polvo' }, density: 0.42 },
  { id: 'choc_chips', nome: { pt: 'Chocolate em gotas', en: 'Chocolate chips', es: 'Chips de chocolate' }, density: 0.72 },
  // Grãos / amidos
  { id: 'rice', nome: { pt: 'Arroz', en: 'Rice (raw)', es: 'Arroz' }, density: 0.78 },
  { id: 'oats', nome: { pt: 'Aveia', en: 'Rolled oats', es: 'Avena' }, density: 0.38 },
  { id: 'cornstarch', nome: { pt: 'Amido de milho', en: 'Cornstarch', es: 'Maicena' }, density: 0.51 },
  // Sais
  { id: 'salt_fine', nome: { pt: 'Sal refinado', en: 'Table salt', es: 'Sal fina' }, density: 1.2 },
  { id: 'salt_coarse', nome: { pt: 'Sal grosso', en: 'Coarse salt', es: 'Sal gruesa' }, density: 0.93 },
  // Fermentos
  { id: 'baking_powder', nome: { pt: 'Fermento químico', en: 'Baking powder', es: 'Polvo de hornear' }, density: 0.9 },
  { id: 'yeast_dry', nome: { pt: 'Fermento biológico seco', en: 'Active dry yeast', es: 'Levadura seca' }, density: 0.75 },
  { id: 'yeast_fresh', nome: { pt: 'Fermento fresco', en: 'Fresh yeast', es: 'Levadura fresca' }, density: 0.9 },
];

export function findDensity(id: string): DensityIngredient | undefined {
  return DENSITY_DB.find(d => d.id === id);
}
