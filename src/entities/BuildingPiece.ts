export type PieceType = 'wall' | 'floor' | 'pillar';
export type ToolMode = PieceType | 'delete' | 'select';

export interface PieceRotation {
  x: number;
  y: number;
  z: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface BuildingPiece {
  id: string;
  type: PieceType;
  gridX: number;
  gridZ: number;
  gridY: number;
  /** Desplazamiento libre desde el centro de la celda ancla (metros). */
  offsetX: number;
  offsetZ: number;
  rotation: PieceRotation;
  mesh: import('@babylonjs/core').AbstractMesh;
  customColor?: RgbColor;
  customMaterial?: import('@babylonjs/core').StandardMaterial;
}

export function pieceId(gridX: number, gridZ: number, gridY: number): string {
  return `${gridX},${gridZ},${gridY}`;
}

export const ZERO_ROTATION: PieceRotation = { x: 0, y: 0, z: 0 };

export const PIECE_TYPE_LABELS: Record<PieceType, string> = {
  wall: 'Muro',
  floor: 'Suelo',
  pillar: 'Columna',
};

export function cloneRotation(rotation: PieceRotation): PieceRotation {
  return { x: rotation.x, y: rotation.y, z: rotation.z };
}

/** Lee la rotación real del mesh (euler o quaternion tras mesh.rotate). */
export function readMeshRotation(mesh: import('@babylonjs/core').AbstractMesh): PieceRotation {
  if (mesh.rotationQuaternion) {
    const euler = mesh.rotationQuaternion.toEulerAngles();
    return { x: euler.x, y: euler.y, z: euler.z };
  }
  return cloneRotation(mesh.rotation);
}

/** Aplica rotación en euler y limpia quaternion para evitar desincronización. */
export function applyMeshRotation(
  mesh: import('@babylonjs/core').AbstractMesh,
  rotation: PieceRotation,
): void {
  mesh.rotationQuaternion = null;
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);
}
