import { createStore } from 'zustand/vanilla';
import type { MaterialTier } from '@/config/materialCatalog';
import {
  cloneDimensions,
  getDefaultDimensions,
  validateDimensions,
  type MaterialDimensions,
} from '@/domain/materials/MaterialDimensions';
import { computeTotalCost } from '@/domain/materials/PricingEngine';
import type {
  BuildingPiece,
  PieceRotation,
  PieceType,
  ToolMode,
} from '@/entities/BuildingPiece';
import { ZERO_ROTATION, cloneRotation } from '@/entities/BuildingPiece';
import { START_BUDGET } from '@/config/gameConfig';

export const ROTATION_STEP = Math.PI / 12;

export type UiPanel = 'tools' | 'rotation' | 'dimensions';
export type GameMode = 'campaign' | 'sandbox';

interface MissionState {
  title: string;
  tagline: string;
  done: number;
  total: number;
}

interface UiVisibility {
  tools: boolean;
  rotation: boolean;
  dimensions: boolean;
}

interface DraftDimensions {
  wall: MaterialDimensions;
  floor: MaterialDimensions;
  pillar: MaterialDimensions;
  roof: MaterialDimensions;
  ramp: MaterialDimensions;
}

interface GameState {
  budget: number;
  gameMode: GameMode;
  completedLevel: number;
  selectedTool: ToolMode;
  pieces: BuildingPiece[];
  previewRotation: PieceRotation;
  draftDimensions: DraftDimensions;
  draftMaterialTier: MaterialTier;
  estimatedCost: number;
  hoveredPieceId: string | null;
  selectedPieceId: string | null;
  uiVisibility: UiVisibility;
  dialogueBlocking: boolean;
  mission: MissionState | null;
  historyRevision: number;
  canUndo: boolean;
  canRedo: boolean;
  measurementActive: boolean;
  setGameMode: (mode: GameMode) => void;
  setCompletedLevel: (level: number) => void;
  setTool: (tool: ToolMode) => void;
  addPiece: (piece: BuildingPiece) => void;
  removePiece: (id: string) => void;
  updatePiece: (id: string, patch: Partial<BuildingPiece>) => void;
  setBudget: (budget: number) => void;
  rotatePreview: (axis: keyof PieceRotation, direction?: 1 | -1) => void;
  setPreviewRotation: (rotation: PieceRotation) => void;
  setDraftDimension: (type: PieceType, key: string, value: number) => void;
  setDraftDimensions: (type: PieceType, dimensions: MaterialDimensions) => void;
  setDraftMaterialTier: (tier: MaterialTier) => void;
  getDraftForTool: (tool: PieceType) => MaterialDimensions;
  refreshEstimatedCost: () => void;
  setHoveredPiece: (id: string | null) => void;
  setSelectedPiece: (id: string | null) => void;
  toggleUiPanel: (panel: UiPanel) => void;
  setDialogueBlocking: (blocking: boolean) => void;
  setMission: (mission: MissionState | null) => void;
  setMeasurementActive: (active: boolean) => void;
  touchHistory: () => void;
  setHistoryAvailability: (canUndo: boolean, canRedo: boolean) => void;
  reset: () => void;
}

const DEFAULT_UI: UiVisibility = {
  tools: true,
  rotation: true,
  dimensions: true,
};

function createDefaultDrafts(): DraftDimensions {
  return {
    wall: getDefaultDimensions('wall'),
    floor: getDefaultDimensions('floor'),
    pillar: getDefaultDimensions('pillar'),
    roof: getDefaultDimensions('roof'),
    ramp: getDefaultDimensions('ramp'),
  };
}

function estimateForTool(
  tool: ToolMode,
  drafts: DraftDimensions,
  tier: MaterialTier,
): number {
  if (tool === 'delete' || tool === 'select') {
    return 0;
  }
  return computeTotalCost(tool, drafts[tool], tier);
}

export const useGameStore = createStore<GameState>((set, get) => ({
  budget: START_BUDGET,
  gameMode: 'campaign',
  completedLevel: 1,
  selectedTool: 'wall',
  pieces: [],
  previewRotation: cloneRotation(ZERO_ROTATION),
  draftDimensions: createDefaultDrafts(),
  draftMaterialTier: 'wood',
  estimatedCost: computeTotalCost('wall', getDefaultDimensions('wall'), 'wood'),
  hoveredPieceId: null,
  selectedPieceId: null,
  uiVisibility: { ...DEFAULT_UI },
  dialogueBlocking: false,
  mission: null,
  historyRevision: 0,
  canUndo: false,
  canRedo: false,
  measurementActive: false,

  setGameMode: (mode) => set({ gameMode: mode }),

  setCompletedLevel: (level) => set({ completedLevel: level }),

  setTool: (tool) =>
    set((state) => ({
      selectedTool: tool,
      estimatedCost: estimateForTool(tool, state.draftDimensions, state.draftMaterialTier),
    })),

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

  setDraftDimension: (type, key, value) =>
    set((state) => {
      const current = state.draftDimensions[type];
      const updated = validateDimensions(type, { ...current, [key]: value });
      const drafts = {
        ...state.draftDimensions,
        [type]: updated,
      };
      return {
        draftDimensions: drafts,
        estimatedCost: estimateForTool(state.selectedTool, drafts, state.draftMaterialTier),
      };
    }),

  setDraftDimensions: (type, dimensions) =>
    set((state) => {
      const drafts = {
        ...state.draftDimensions,
        [type]: validateDimensions(type, cloneDimensions(dimensions)),
      };
      return {
        draftDimensions: drafts,
        estimatedCost: estimateForTool(state.selectedTool, drafts, state.draftMaterialTier),
      };
    }),

  setDraftMaterialTier: (tier) =>
    set((state) => ({
      draftMaterialTier: tier,
      estimatedCost: estimateForTool(state.selectedTool, state.draftDimensions, tier),
    })),

  getDraftForTool: (tool) => get().draftDimensions[tool],

  refreshEstimatedCost: () => {
    const state = get();
    set({
      estimatedCost: estimateForTool(
        state.selectedTool,
        state.draftDimensions,
        state.draftMaterialTier,
      ),
    });
  },

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

  setMission: (mission) =>
    set((state) => {
      const current = state.mission;
      if (current === mission) {
        return state;
      }
      if (
        current &&
        mission &&
        current.title === mission.title &&
        current.tagline === mission.tagline &&
        current.done === mission.done &&
        current.total === mission.total
      ) {
        return state;
      }
      if (!current && !mission) {
        return state;
      }
      return { mission };
    }),

  setMeasurementActive: (active) => set({ measurementActive: active }),

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
    set((state) => ({
      budget: state.gameMode === 'sandbox' ? 999_999 : START_BUDGET,
      selectedTool: 'wall',
      pieces: [],
      previewRotation: cloneRotation(ZERO_ROTATION),
      draftDimensions: createDefaultDrafts(),
      draftMaterialTier: 'wood',
      estimatedCost: computeTotalCost('wall', getDefaultDimensions('wall'), 'wood'),
      hoveredPieceId: null,
      selectedPieceId: null,
      uiVisibility: { ...DEFAULT_UI },
      dialogueBlocking: false,
      mission: state.gameMode === 'sandbox' ? null : state.mission,
      historyRevision: 0,
      canUndo: false,
      canRedo: false,
      measurementActive: false,
    })),
}));
