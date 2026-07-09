import { createStore } from 'zustand/vanilla';
import type {
  BuildingPiece,
  PieceRotation,
  ToolMode,
} from '@/entities/BuildingPiece';
import { ZERO_ROTATION, cloneRotation } from '@/entities/BuildingPiece';
import { START_BUDGET } from '@/config/gameConfig';

export const ROTATION_STEP = Math.PI / 12;

export type UiPanel = 'tools' | 'rotation';

interface MissionState {
  title: string;
  tagline: string;
  done: number;
  total: number;
}

interface UiVisibility {
  tools: boolean;
  rotation: boolean;
}

interface GameState {
  budget: number;
  selectedTool: ToolMode;
  pieces: BuildingPiece[];
  previewRotation: PieceRotation;
  hoveredPieceId: string | null;
  selectedPieceId: string | null;
  uiVisibility: UiVisibility;
  dialogueBlocking: boolean;
  mission: MissionState | null;
  historyRevision: number;
  canUndo: boolean;
  canRedo: boolean;
  setTool: (tool: ToolMode) => void;
  addPiece: (piece: BuildingPiece) => void;
  removePiece: (id: string) => void;
  updatePiece: (id: string, patch: Partial<BuildingPiece>) => void;
  relocatePiece: (oldId: string, newId: string, gridX: number, gridZ: number) => void;
  setBudget: (budget: number) => void;
  rotatePreview: (axis: keyof PieceRotation, direction?: 1 | -1) => void;
  setPreviewRotation: (rotation: PieceRotation) => void;
  setHoveredPiece: (id: string | null) => void;
  setSelectedPiece: (id: string | null) => void;
  toggleUiPanel: (panel: UiPanel) => void;
  setDialogueBlocking: (blocking: boolean) => void;
  setMission: (mission: MissionState | null) => void;
  touchHistory: () => void;
  setHistoryAvailability: (canUndo: boolean, canRedo: boolean) => void;
  reset: () => void;
}

const DEFAULT_UI: UiVisibility = {
  tools: true,
  rotation: true,
};

export const useGameStore = createStore<GameState>((set, get) => ({
  budget: START_BUDGET,
  selectedTool: 'wall',
  pieces: [],
  previewRotation: cloneRotation(ZERO_ROTATION),
  hoveredPieceId: null,
  selectedPieceId: null,
  uiVisibility: { ...DEFAULT_UI },
  dialogueBlocking: false,
  mission: null,
  historyRevision: 0,
  canUndo: false,
  canRedo: false,

  setTool: (tool) => set({ selectedTool: tool }),

  addPiece: (piece) =>
    set((state) => ({
      pieces: [...state.pieces, piece],
    })),

  removePiece: (id) =>
    set((state) => ({
      pieces: state.pieces.filter((piece) => piece.id !== id),
      selectedPieceId: state.selectedPieceId === id ? null : state.selectedPieceId,
      hoveredPieceId: state.hoveredPieceId === id ? null : state.hoveredPieceId,
    })),

  updatePiece: (id, patch) =>
    set((state) => ({
      pieces: state.pieces.map((piece) =>
        piece.id === id ? { ...piece, ...patch } : piece,
      ),
    })),

  relocatePiece: (oldId, newId, gridX, gridZ) =>
    set((state) => ({
      pieces: state.pieces.map((piece) =>
        piece.id === oldId
          ? { ...piece, id: newId, gridX, gridZ }
          : piece,
      ),
      selectedPieceId: state.selectedPieceId === oldId ? newId : state.selectedPieceId,
      hoveredPieceId: state.hoveredPieceId === oldId ? newId : state.hoveredPieceId,
    })),

  setBudget: (budget) => set({ budget }),

  rotatePreview: (axis, direction = 1) => {
    const current = get().previewRotation;
    set({
      previewRotation: {
        ...current,
        [axis]: current[axis] + ROTATION_STEP * direction,
      },
    });
  },

  setPreviewRotation: (rotation) => set({ previewRotation: cloneRotation(rotation) }),

  setHoveredPiece: (id) => set({ hoveredPieceId: id }),

  setSelectedPiece: (id) => set({ selectedPieceId: id }),

  toggleUiPanel: (panel) =>
    set((state) => ({
      uiVisibility: {
        ...state.uiVisibility,
        [panel]: !state.uiVisibility[panel],
      },
    })),

  setDialogueBlocking: (blocking) => set({ dialogueBlocking: blocking }),

  setMission: (mission) => set({ mission }),

  touchHistory: () => set((state) => ({ historyRevision: state.historyRevision + 1 })),

  setHistoryAvailability: (canUndo, canRedo) =>
    set((state) => {
      if (state.canUndo === canUndo && state.canRedo === canRedo) {
        return state;
      }
      return {
        canUndo,
        canRedo,
        historyRevision: state.historyRevision + 1,
      };
    }),

  reset: () =>
    set({
      budget: START_BUDGET,
      selectedTool: 'wall',
      pieces: [],
      previewRotation: cloneRotation(ZERO_ROTATION),
      hoveredPieceId: null,
      selectedPieceId: null,
      uiVisibility: { ...DEFAULT_UI },
      dialogueBlocking: false,
      mission: null,
      historyRevision: 0,
      canUndo: false,
      canRedo: false,
    }),
}));
