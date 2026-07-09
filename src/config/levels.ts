import type { PieceType } from '@/entities/BuildingPiece';

export type ObjectiveKind =
  | 'count'
  | 'totalPieces'
  | 'minHeight'
  | 'budgetMin'
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
      'La franja gris es una carretera: está prohibido construir sobre ella.',
      'Erige muros, tiende suelos y alza una columna. Teclas 1–5 · Clic derecho para seleccionar.',
    ],
    objectives: [
      { id: 'roads', kind: 'roadClear', text: 'Mantén la carretera libre' },
      { id: 'walls', kind: 'count', text: 'Erige 4 muros de defensa', pieceType: 'wall', count: 4 },
      { id: 'floors', kind: 'count', text: 'Tendé 2 suelos nobles', pieceType: 'floor', count: 2 },
      { id: 'pillar', kind: 'count', text: 'Alza 1 columna regia', pieceType: 'pillar', count: 1 },
    ],
    budget: 1000,
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
      'Levanta columnas a los lados y tiende suelos elevados para formar un puente.',
      'Tecla 4 borra · 5 selecciona · botones Deshacer/Rehacer en el panel.',
    ],
    objectives: [
      { id: 'roads', kind: 'roadClear', text: 'Mantén la avenida libre a nivel del suelo' },
      { id: 'bridge', kind: 'bridge', text: 'Tiende 4 suelos de puente sobre la carretera', count: 4 },
      { id: 'height', kind: 'minHeight', text: 'Alcanza 2 pisos de altura', minHeight: 2 },
      { id: 'pillars', kind: 'count', text: 'Refuerza con 2 columnas', pieceType: 'pillar', count: 2 },
    ],
    budget: 900,
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
      'Un anillo vial rodea el centro. Respétalo y construye alrededor.',
      'Clic derecho selecciona piezas desde cualquier herramienta.',
    ],
    objectives: [
      { id: 'roads', kind: 'roadClear', text: 'Respeta el anillo vial' },
      { id: 'enclosure', kind: 'enclosure', text: 'Cierra un salón con 4 muros', count: 4 },
      { id: 'walls', kind: 'count', text: 'Despliega al menos 8 muros', pieceType: 'wall', count: 8 },
      { id: 'total', kind: 'totalPieces', text: 'Coloca 12 piezas en total', count: 12 },
    ],
    budget: 1200,
    victory: [
      '¡INCREÍBLE! La Fortaleza del Cénit se alza ante el mundo.',
      'Has conquistado los tres desafíos del gremio. Eres leyenda viviente de SCALA.',
    ],
  },
];

export const DEFAULT_LEVEL = LEVELS[0]!;
