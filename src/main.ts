import './style.css';
import './home.css';
import './ui/dialogue.css';
import { Game } from '@/core/Game';
import { HomeScreen } from '@/ui/HomeScreen';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement | null;
const hudRoot = document.getElementById('hud');
const selectionRoot = document.getElementById('selection-panel');
const moveRoot = document.getElementById('move-panel');
const toolbarRoot = document.getElementById('ui-toolbar');
const dialogueRoot = document.getElementById('dialogue-box');
const homeRoot = document.getElementById('home');

if (!canvas || !hudRoot || !selectionRoot || !moveRoot || !toolbarRoot || !dialogueRoot || !homeRoot) {
  throw new Error('Missing render canvas, HUD, selection panel, move panel, toolbar, dialogue or home container.');
}

let game: Game | null = null;

const home = new HomeScreen(homeRoot, () => {
  home.hide();
  document.body.classList.add('is-playing');

  game = new Game(canvas, hudRoot, selectionRoot, moveRoot, toolbarRoot, dialogueRoot);
  game.start();
});

window.addEventListener('beforeunload', () => {
  game?.destroy();
});
