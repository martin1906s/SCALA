import './ui/tokens.css';
import './style.css';
import './ui/game-ui.css';
import './responsive.css';
import './home.css';
import './ui/dialogue.css';
import { Game } from '@/core/Game';
import { HomeScreen } from '@/ui/HomeScreen';
import { loadSave } from '@/utils/progressStorage';
import { bindOrientationGate, syncOrientationGate, tryLockLandscape } from '@/utils/orientation';
import { useGameStore } from '@/store/gameStore';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement | null;
const hudRoot = document.getElementById('hud');
const selectionRoot = document.getElementById('selection-panel');
const dimensionRoot = document.getElementById('dimension-panel');
const moveRoot = document.getElementById('move-panel');
const toolbarRoot = document.getElementById('ui-toolbar');
const dialogueRoot = document.getElementById('dialogue-box');
const homeRoot = document.getElementById('home');

if (
  !canvas || !hudRoot || !selectionRoot || !dimensionRoot
  || !moveRoot || !toolbarRoot || !dialogueRoot || !homeRoot
) {
  throw new Error('Missing render canvas or UI containers.');
}

const save = loadSave();
useGameStore.getState().setCompletedLevel(save.maxCompletedLevel);
for (const [levelId, stars] of Object.entries(save.stars)) {
  useGameStore.getState().setLevelStars(Number(levelId), stars);
}

let game: Game | null = null;

bindOrientationGate();

const home = new HomeScreen(homeRoot, ({ mode, levelIndex = 0 }) => {
  home.hide();
  document.body.classList.add('is-playing');
  syncOrientationGate();

  void tryLockLandscape();

  game = new Game(
    canvas,
    hudRoot,
    selectionRoot,
    dimensionRoot,
    moveRoot,
    toolbarRoot,
    dialogueRoot,
    mode,
    levelIndex,
  );
  game.start();
});

window.addEventListener('beforeunload', () => {
  game?.destroy();
});
