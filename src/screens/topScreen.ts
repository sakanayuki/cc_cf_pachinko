import { loadHighScore } from '../game/storage';

export function renderTopScreen(onStart: () => void): HTMLElement {
  const el = document.createElement('div');
  el.id = 'screen-top';
  el.className = 'screen';

  const hs = loadHighScore();

  el.innerHTML = `
    <div class="top-lanterns">
      ${'<div class="lantern"><span>祭</span></div>'.repeat(5)}
    </div>
    <div class="title-board">
      <div class="title-deco-row">
        <span class="title-marble m-blue"></span>
        <span class="title-marble m-clear"></span>
        <span class="title-marble m-green"></span>
        <span class="title-marble m-amber"></span>
        <span class="title-marble m-blue"></span>
      </div>
      <h1 class="title-main">
        <span>ス</span><span>マ</span><span>ー</span><span>ト</span><span>ボ</span><span>ー</span><span>ル</span>
      </h1>
      <div class="title-sub">— SMART BALL —</div>
    </div>
    <div class="top-rules">
      ハンドルを引いて玉を打ち出し、<br>
      タテ・ヨコ・ナナメに穴をそろえよう！
    </div>
    <div class="highscore-display">${hs > 0 ? `🏆 ベストスコア ${hs} 列` : '&nbsp;'}</div>
    <button class="btn btn-start" id="btn-start">あそぶ</button>
  `;

  el.querySelector('#btn-start')!.addEventListener('pointerup', (e) => {
    e.preventDefault();
    onStart();
  });

  return el;
}
