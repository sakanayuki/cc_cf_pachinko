import { loadHighScore } from '../game/storage';

export function renderTopScreen(onStart: () => void): HTMLElement {
  const el = document.createElement('div');
  el.id = 'screen-top';
  el.className = 'screen';

  const hs = loadHighScore();

  el.innerHTML = `
    <div class="top-lanterns">
      <div class="lantern"></div>
      <div class="lantern"></div>
      <div class="lantern"></div>
      <div class="lantern"></div>
      <div class="lantern"></div>
    </div>
    <div class="title-board">
      <div class="title-main">スマートボール</div>
      <div class="title-sub">SMART BALL</div>
    </div>
    ${hs > 0 ? `<div class="highscore-display">ベストスコア: ${hs} 列</div>` : '<div class="highscore-display">&nbsp;</div>'}
    <button class="btn btn-start" id="btn-start">スタート</button>
  `;

  el.querySelector('#btn-start')!.addEventListener('pointerup', (e) => {
    e.preventDefault();
    onStart();
  });

  return el;
}
