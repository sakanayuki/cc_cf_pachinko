import { getScoreMessage } from '../game/board';
import type { Board } from '../game/board';
import { saveHighScore, loadHighScore } from '../game/storage';

export function renderResultScreen(
  score: number,
  board: Board,
  onRetry: () => void,
  onTop: () => void,
): HTMLElement {
  const prevBest = loadHighScore();
  const highScore = saveHighScore(score);
  const isNewRecord = score > 0 && score > prevBest;
  const message = getScoreMessage(score);

  const el = document.createElement('div');
  el.id = 'screen-result';
  el.className = 'screen';

  const cells = board.flat()
    .map(filled => `<div class="result-cell${filled ? ' filled' : ''}"></div>`)
    .join('');

  const confetti = score >= 1
    ? `<div class="confetti">${Array.from({ length: 24 })
        .map((_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`
    : '';

  el.innerHTML = `
    ${confetti}
    <div class="result-board">
      <div class="result-label">そろった列</div>
      <div class="result-score-row">
        <span class="result-score">${score}</span><span class="result-unit">列</span>
      </div>
      <div class="result-message">${message}</div>
      ${isNewRecord
        ? '<div class="result-highscore new-record">🏆 新記録！</div>'
        : `<div class="result-highscore">${highScore > 0 ? `ベストスコア ${highScore} 列` : '&nbsp;'}</div>`}
      <div class="result-board-preview">${cells}</div>
    </div>
    <button class="btn btn-retry" id="btn-retry">もう一度あそぶ</button>
    <button class="btn-text" id="btn-top">タイトルへもどる</button>
  `;

  el.querySelector('#btn-retry')!.addEventListener('pointerup', (e) => {
    e.preventDefault();
    onRetry();
  });
  el.querySelector('#btn-top')!.addEventListener('pointerup', (e) => {
    e.preventDefault();
    onTop();
  });

  return el;
}
