import {
  CANVAS_W, CANVAS_H, BALL_RADIUS, NAIL_RADIUS, HOLE_RADIUS,
  DEFLECTOR_CENTER_X, DEFLECTOR_CENTER_Y, DEFLECTOR_RADIUS,
  DEFLECTOR_ANGLE_START, DEFLECTOR_ANGLE_END,
  LANE_WALL_X, LANE_WALL_Y_TOP,
} from './constants';
import type { PhysicsWorld } from './physics';
import type { Board } from './board';
import { holePosition } from './board';

const COLORS = {
  wood: '#A9743B',
  woodDark: '#7A4A1E',
  nail: '#8B6914',
  hole: '#111111',
  holeBorder: 'rgba(255,255,255,0.15)',
  ball: '#FFFFFF',
  ballShadow: 'rgba(0,0,0,0.35)',
  lane: '#B89040',
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

  drawLane(ctx);
  drawDecorativeNails(ctx);
  drawHoles(ctx, board);
  drawNails(ctx, world);
  drawBalls(ctx, world);
}

// Cosmetic nails in the upper launch area (which a ball never reaches, since it
// deflects off the top rail at ~y210). Purely visual: makes the whole board
// up to the header read as an active pachinko field, with zero gameplay effect.
function drawDecorativeNails(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const rows: [number, number[]][] = [
    [60, [0.12, 0.30, 0.48, 0.66, 0.84]],
    [95, [0.21, 0.39, 0.57, 0.75]],
    [130, [0.12, 0.30, 0.48, 0.66, 0.84]],
  ];
  for (const [y, xs] of rows) {
    for (const xr of xs) {
      const x = xr * CANVAS_W;
      if (x > 330) continue; // keep clear of the launch chute
      ctx.beginPath();
      ctx.arc(x, y, NAIL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.nail;
      ctx.fill();
      ctx.strokeStyle = '#C8A44A';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLane(ctx: CanvasRenderingContext2D): void {
  ctx.save();

  // Unified wood background – fills the entire canvas so upper and lower
  // areas share the same look with no separate frame.
  ctx.fillStyle = COLORS.lane;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Wood grain across the full canvas (deterministic)
  for (let i = 0; i < 44; i++) {
    const gy = (i / 44) * CANVAS_H;
    const wave = ((i * 7) % 5) - 2;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(CANVAS_W, gy + wave);
    ctx.stroke();
  }

  // Launch lane / chute on the right side (where the ball rises before the
  // deflector turns it left).
  const chuteW = CANVAS_W - LANE_WALL_X;
  ctx.fillStyle = COLORS.woodDark;
  ctx.fillRect(LANE_WALL_X, LANE_WALL_Y_TOP, chuteW, CANVAS_H - LANE_WALL_Y_TOP);
  ctx.fillRect(LANE_WALL_X, 0, chuteW, LANE_WALL_Y_TOP);
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = 2;
  ctx.strokeRect(LANE_WALL_X, 0, chuteW, CANVAS_H);

  // Top-right deflector curve (the curve the ball follows) — drawn last so it
  // reads as a continuous rail over the lane.
  ctx.beginPath();
  ctx.arc(DEFLECTOR_CENTER_X, DEFLECTOR_CENTER_Y, DEFLECTOR_RADIUS,
    DEFLECTOR_ANGLE_START, DEFLECTOR_ANGLE_END);
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Inner highlight line
  ctx.strokeStyle = COLORS.laneBorder;
  ctx.lineWidth = 2;
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
  // Anchor to the top so the playfield starts right under the header instead of
  // leaving a wasteful empty band above it.
  canvas.style.top = '0px';

  // Set actual pixel resolution (devicePixelRatio aware)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
}
