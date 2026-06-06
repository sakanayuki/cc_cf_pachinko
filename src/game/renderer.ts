import { CANVAS_W, CANVAS_H, BALL_RADIUS, NAIL_RADIUS, HOLE_RADIUS } from './constants';
import type { PhysicsWorld } from './physics';
import type { Board } from './board';
import { holePosition } from './board';

const COLORS = {
  bg: '#2a1a3e',
  boardBg: '#1e3a5f',
  wood: '#A9743B',
  woodDark: '#7A4A1E',
  nail: '#8B6914',
  hole: '#111111',
  holeBorder: 'rgba(255,255,255,0.15)',
  ball: '#FFFFFF',
  ballShadow: 'rgba(0,0,0,0.35)',
  lane: '#2e4a6e',
  laneBorder: '#A9743B',
  yellow: '#F6C445',
  red: '#E23B2E',
};

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld,
  board: Board,
): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawLane(ctx);
  drawBoardArea(ctx);
  drawHoles(ctx, board);
  drawNails(ctx, world);
  drawBalls(ctx, world);
}

function drawLane(ctx: CanvasRenderingContext2D): void {
  // Upper curved lane background
  ctx.save();
  ctx.fillStyle = COLORS.lane;
  ctx.strokeStyle = COLORS.laneBorder;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_W, 165);
  ctx.fill();
  ctx.strokeRect(0, 0, CANVAS_W, 165);

  // Launch chute on the right side
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(CANVAS_W - 28, 0, 28, CANVAS_H);
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = 2;
  ctx.strokeRect(CANVAS_W - 28, 0, 28, CANVAS_H);

  ctx.restore();
}

function drawBoardArea(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // Main board background
  ctx.fillStyle = COLORS.boardBg;
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = 4;

  const bx = 20, by = 165, bw = CANVAS_W - 48, bh = CANVAS_H - 165 - 20;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHoles(ctx: CanvasRenderingContext2D, board: Board): void {
  ctx.save();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const { x, y } = holePosition(r, c);
      const filled = board[r][c];

      // Hole (always black)
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.hole;
      ctx.fill();
      ctx.strokeStyle = COLORS.holeBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ball inside hole if filled
      if (filled) {
        ctx.beginPath();
        ctx.arc(x, y, HOLE_RADIUS - 4, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.ball;
        ctx.fill();

        // Subtle highlight
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, (HOLE_RADIUS - 4) * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawNails(ctx: CanvasRenderingContext2D, world: PhysicsWorld): void {
  ctx.save();
  for (const body of world.nailBodies) {
    const { x, y } = body.position;
    ctx.beginPath();
    ctx.arc(x, y, NAIL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.nail;
    ctx.fill();
    ctx.strokeStyle = '#C8A44A';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBalls(ctx: CanvasRenderingContext2D, world: PhysicsWorld): void {
  ctx.save();
  for (const ball of world.balls) {
    if (ball.state === 'removed') continue;
    if (ball.state === 'settled') continue; // drawn in drawHoles
    const { x, y } = ball.body.position;

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ballShadow;
    ctx.fill();

    // Ball
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, BALL_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function resizeCanvas(canvas: HTMLCanvasElement): void {
  const wrapper = canvas.parentElement!;
  const wrapW = wrapper.clientWidth;
  const wrapH = wrapper.clientHeight;
  const scale = Math.min(wrapW / CANVAS_W, wrapH / CANVAS_H);
  const dispW = CANVAS_W * scale;
  const dispH = CANVAS_H * scale;

  canvas.style.width = `${dispW}px`;
  canvas.style.height = `${dispH}px`;
  canvas.style.position = 'absolute';
  canvas.style.left = `${(wrapW - dispW) / 2}px`;
  canvas.style.top = `${(wrapH - dispH) / 2}px`;

  // Set actual pixel resolution (devicePixelRatio aware)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
}
