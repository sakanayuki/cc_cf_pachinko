import { renderTopScreen } from './screens/topScreen';
import { renderGameScreen } from './screens/gameScreen';
import { renderResultScreen } from './screens/resultScreen';
import type { Board } from './game/board';

const app = document.getElementById('app')!;

// Orientation warning
const orientWarn = document.createElement('div');
orientWarn.id = 'orientation-warning';
orientWarn.innerHTML = `<div style="font-size:48px">📱</div><div>縦向きにしてください</div>`;
document.body.appendChild(orientWarn);

let currentEl: HTMLElement | null = null;

function show(el: HTMLElement): void {
  if (currentEl) {
    currentEl.remove();
  }
  app.appendChild(el);
  currentEl = el;
}

function goTop(): void {
  show(renderTopScreen(goGame));
}

function goGame(): void {
  show(renderGameScreen(goResult));
}

function goResult(score: number, board: Board): void {
  show(renderResultScreen(score, board, goGame));
}

// Start
goTop();

// Prevent default touch behaviors globally
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
