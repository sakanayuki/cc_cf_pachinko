import { GRID_SIZE, HOLE_GRID_ORIGIN_X, HOLE_GRID_ORIGIN_Y, HOLE_SPACING } from './constants';

export type Board = boolean[][];

export function createBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
}

export function fillCell(board: Board, row: number, col: number): Board {
  const next = board.map(r => [...r]);
  next[row][col] = true;
  return next;
}

export function countLines(board: Board): number {
  let lines = 0;
  for (let r = 0; r < GRID_SIZE; r++) if (board[r].every(Boolean)) lines++;
  for (let c = 0; c < GRID_SIZE; c++) if (board.every(row => row[c])) lines++;
  if ([0, 1, 2, 3].every(i => board[i][i])) lines++;
  if ([0, 1, 2, 3].every(i => board[i][GRID_SIZE - 1 - i])) lines++;
  return lines;
}

export function getScoreMessage(lines: number): string {
  if (lines === 0) return '残念…';
  if (lines <= 3) return 'すごい！';
  if (lines <= 9) return 'とても上手！';
  return 'パーフェクト！';
}

export function holePosition(row: number, col: number): { x: number; y: number } {
  return {
    x: HOLE_GRID_ORIGIN_X + col * HOLE_SPACING,
    y: HOLE_GRID_ORIGIN_Y + row * HOLE_SPACING,
  };
}
