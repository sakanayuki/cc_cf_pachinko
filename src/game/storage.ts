const KEY = 'smartball.highScore';

export function loadHighScore(): number {
  try {
    return parseInt(localStorage.getItem(KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): number {
  const best = Math.max(loadHighScore(), score);
  try {
    localStorage.setItem(KEY, String(best));
  } catch { /* ignore */ }
  return best;
}
