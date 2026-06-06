import { getScoreMessage } from '../game/board';
import type { Board } from '../game/board';
import { saveHighScore } from '../game/storage';

export function renderResultScreen(
  score: number,
  board: Board,
  onRetry: () => void,
): HTMLElement {
  const highScore = saveHighScore(score);
  const message = getScoreMessage(score);
  const isNewRecord = score > 0 && score === highScore;

  const el = document.createElement('div');
  el.id = 'screen-result';
  el.className = 'screen';

  // Build board preview HTML
  const cells = board.flat()
    .map(filled => `<div class="result-cell${filled ? ' filled' : ''}"></div>`)
    .join('');

  el.innerHTML = `
    <div class="result-fireworks">${score >= 10 ? '🎉' : score >= 4 ? '🎊' : score >= 1 ? '👏' : '😢'}</div>
    <div class="result-board">
      <div class="result-label">スコア</div>
      <div class="result-score">${score}</div>
      <div class="result-unit">列</div>
      <div class="result-message">${message}</div>
      ${isNewRecord ? '<div class="result-highscore" style="color:#F6C445;font-weight:900;">🏆 新記録！</div>' : `<div class="result-highscore">ベストスコア: ${highScore} 列</div>`}
      <div class="result-board-preview">${cells}</div>
    </div>
    <button class="btn btn-retry" id="btn-retry">もう一度遊ぶ</button>
  `;

  el.querySelector('#btn-retry')!.addEventListener('pointerup', (e) => {
    e.preventDefault();
    onRetry();
  });

  return el;
}
