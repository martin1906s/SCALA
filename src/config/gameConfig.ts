export const GRID_SIZE = 20;
export const CELL_SIZE = 1;
export const WORLD_HALF = (GRID_SIZE * CELL_SIZE) / 2;
export const START_BUDGET = 1000;
export const REFUND_RATE = 0.8;
export const MAX_STACK_LAYERS = 10;
export const LAYER_STEP = 1;
/** Precisión de movimiento libre (milésimas de unidad). */
export const POSITION_PRECISION = 0.001;
export const FREE_MOVE_STEP = POSITION_PRECISION;

export const PIECE_COSTS = {
  wall: 50,
  floor: 30,
  pillar: 40,
} as const;

export const PIECE_DIMS = {
  wall: { width: 0.85, height: 1, depth: 0.2 },
  floor: { width: 0.92, height: 0.12, depth: 0.92 },
  pillar: { diameter: 0.5, height: 1.2 },
} as const;

export const PIECE_COLORS = {
  wall: { r: 0.92, g: 0.48, b: 0.38 },
  floor: { r: 0.78, g: 0.58, b: 0.32 },
  pillar: { r: 0.52, g: 0.72, b: 0.95 },
} as const;

export const CAMERA = {
  alpha: -Math.PI / 4,
  beta: 1.05,
  radius: 28,
  minRadius: 18,
  maxRadius: 45,
  lowerBeta: 0.45,
  upperBeta: 1.35,
} as const;
