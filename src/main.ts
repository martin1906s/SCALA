import './style.css';
import './home.css';
import './ui/dialogue.css';
import { Game } from '@/core/Game';
import { HomeScreen } from '@/ui/HomeScreen';
import type { GameMode } from '@/store/gameStore';

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

let game: Game | null = null;

const home = new HomeScreen(homeRoot, (mode: GameMode) => {
  home.hide();
  document.body.classList.add('is-playing');

  game = new Game(
    canvas,
    hudRoot,
    selectionRoot,
    dimensionRoot,
    moveRoot,
    toolbarRoot,
    dialogueRoot,
    mode,
  );
  game.start();
});

window.addEventListener('beforeunload', () => {
  game?.destroy();
});
