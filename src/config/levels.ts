import type { PieceType } from '@/entities/BuildingPiece';

export type ObjectiveKind =
  | 'count'
  | 'totalPieces'
  | 'minHeight'
  | 'budgetMin'
  | 'budgetEfficiency'
  | 'minArea'
  | 'minSpan'
  | 'tierCount'
  | 'enclosure'
  | 'roadClear'
  | 'bridge';

export interface LevelObjective {
  id: string;
  text: string;
  kind: ObjectiveKind;
  pieceType?: PieceType;
  count?: number;
  minHeight?: number;
  minBudget?: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  tagline: string;
  intro: string[];
  objectives: LevelObjective[];
  budget: number;
  victory: string[];
}

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: 'Fundamentos del Alba',
    tagline: 'Capítulo I · Despierta el constructor',
    intro: [
      'El gremio de SCALA te observa desde las alturas. Tu primera prueba ha comenzado.',
      'Ajusta las dimensiones en el Taller de materiales antes de colocar.',
      'La franja gris es una carretera: está prohibido construir sobre ella a nivel del suelo.',
    ],
    objectives: [
      { id: 'roads', kind: 'roadClear', text: 'Mantén la carretera libre' },
      { id: 'walls', kind: 'count', text: 'Erige 3 muros de defensa', pieceType: 'wall', count: 3 },
      { id: 'floors', kind: 'minArea', text: 'Tendé al menos 2 m² de suelo', count: 2 },
      { id: 'pillar', kind: 'count', text: 'Alza 1 columna regia', pieceType: 'pillar', count: 1 },
    ],
    budget: 1200,
    victory: [
      '¡El Alba sonríe! Tus cimientos resuenan con fuerza.',
      'Has demostrado instinto de constructor. La siguiente prueba te espera en las alturas…',
    ],
  },
  {
    id: 2,
    name: 'Puente sobre la Avenida',
    tagline: 'Capítulo II · Cruzar sin bloquear',
    intro: [
      'Una avenida atraviesa el mapa. No puedes construir a ras de suelo sobre ella.',
      'Usa la plantilla "Puente básico" o dimensiona un suelo largo elevado.',
      'Las columnas de piedra resisten mejor — prueba el tier Piedra.',
    ],
    objectives: [
      { id: 'roads', kind: 'roadClear', text: 'Mantén la avenida libre a nivel del suelo' },
      { id: 'bridge', kind: 'minSpan', text: 'Puente de al menos 4 celdas sobre la carretera', count: 4 },
      { id: 'height', kind: 'minHeight', text: 'Alcanza 2 pisos de altura', minHeight: 2 },
      { id: 'pillars', kind: 'tierCount', text: 'Usa 2 piezas de piedra o superior', count: 2 },
    ],
    budget: 1100,
    victory: [
      '¡Tu puente cruza la avenida! El tráfico puede circular bajo tus cimientos.',
      'El gremio anota tu hazaña. Queda un último reto: la Fortaleza del Cénit.',
    ],
  },
  {
    id: 3,
    name: 'La Fortaleza del Cénit',
    tagline: 'Capítulo III · Maestría arquitectónica',
    intro: [
      'El consejo real exige una fortaleza impenetrable: un salón sellado por muros de piedra.',
      'Dimensiona muros gruesos y plataformas amplias. El costo depende del área y volumen.',
      'Clic derecho selecciona piezas desde cualquier herramienta.',
    ],
    objectives: [
      { id: 'roads', kind: 'roadClear', text: 'Respeta el anillo vial' },
      { id: 'enclosure', kind: 'enclosure', text: 'Cierra un salón con 4 muros', count: 4 },
      { id: 'walls', kind: 'count', text: 'Despliega al menos 6 muros', pieceType: 'wall', count: 6 },
      { id: 'area', kind: 'minArea', text: 'Superficie total de suelos ≥ 8 m²', count: 8 },
      { id: 'budget', kind: 'budgetEfficiency', text: 'Conserva al menos 15% del presupuesto', minBudget: 15 },
    ],
    budget: 1500,
    victory: [
      '¡INCREÍBLE! La Fortaleza del Cénit se alza ante el mundo.',
      'Has conquistado los tres desafíos del gremio. Eres leyenda viviente de SCALA.',
    ],
  },
];

export const DEFAULT_LEVEL = LEVELS[0]!;
