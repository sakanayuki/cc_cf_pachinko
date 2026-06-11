import {
  CANVAS_W, CANVAS_H, FRAME_W, BALL_RADIUS, NAIL_RADIUS, HOLE_RADIUS,
  CHUTE_INNER_X, CHUTE_WALL_TOP, ARCH_CX, ARCH_CY, ARCH_R,
  HOLE_SPACING, GRID_SIZE,
} from './constants';
import type { PhysicsWorld } from './physics';
import { LAUNCH_X, LAUNCH_Y, nailPositions } from './physics';
import type { Board } from './board';
import { holePosition } from './board';

const C = {
  cream: '#F5EFDD',
  creamShade: '#E9E0C8',
  chromeLight: '#F2F4F6',
  chromeMid: '#C4C9CF',
  chromeDark: '#7E848C',
  backboard: '#26221C',
  redBand: '#E0564A',
  redBandDark: '#B83A30',
  blueBand: '#4D8FCC',
  blueBandDark: '#36699C',
  gold: '#F2C84B',
  goldDark: '#C99B26',
  holeDeep: '#1D241A',
  holeMid: '#3C4733',
  plate: '#F4C93C',
  plateDark: '#C79E1E',
};

// Marble tints: [light, mid, dark]
const MARBLE_TINTS: [string, string, string][] = [
  ['#FFFFFF', '#DCE8EE', '#9FB4BF'], // clear glass
  ['#D6EBFF', '#7FB4E6', '#3E6FA3'], // blue
  ['#DFF5E1', '#9FD6A8', '#558A60'], // green
  ['#FFF3D6', '#F2CE7E', '#B98E3A'], // amber
];

let boardLayer: HTMLCanvasElement | null = null;
const LAYER_SCALE = 2;

export function invalidateBoardLayer(): void {
  boardLayer = null;
}

function getBoardLayer(): HTMLCanvasElement {
  if (boardLayer) return boardLayer;
  const cv = document.createElement('canvas');
  cv.width = CANVAS_W * LAYER_SCALE;
  cv.height = CANVAS_H * LAYER_SCALE;
  const ctx = cv.getContext('2d')!;
  ctx.scale(LAYER_SCALE, LAYER_SCALE);
  paintStaticBoard(ctx);
  boardLayer = cv;
  return cv;
}

function fieldPath(ctx: CanvasRenderingContext2D, inset: number): void {
  const left = FRAME_W + inset;
  const right = CANVAS_W - FRAME_W - inset;
  const bottom = CANVAS_H - FRAME_W - inset;
  const r = ARCH_R + inset;
  const aL = Math.atan2(
    -Math.sqrt(Math.max(r * r - (left - ARCH_CX) ** 2, 0)),
    left - ARCH_CX
  );
  const aR = Math.atan2(
    -Math.sqrt(Math.max(r * r - (right - ARCH_CX) ** 2, 0)),
    right - ARCH_CX
  );
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, ARCH_CY + r * Math.sin(aL));
  ctx.arc(ARCH_CX, ARCH_CY, r, aL, aR);
  ctx.lineTo(right, bottom);
  ctx.closePath();
}

function paintStaticBoard(ctx: CanvasRenderingContext2D): void {
  // Backboard behind the arch + chrome frame
  ctx.fillStyle = C.backboard;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  paintChromeFrame(ctx);

  // Cream playfield inside the arch
  ctx.save();
  fieldPath(ctx, 0);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, '#FAF5E6');
  bg.addColorStop(0.55, C.cream);
  bg.addColorStop(1, C.creamShade);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // soft vignette along the edges
  fieldPath(ctx, 0);
  ctx.strokeStyle = 'rgba(90, 70, 30, 0.18)';
  ctx.lineWidth = 14;
  ctx.stroke();
  fieldPath(ctx, 0);
  ctx.strokeStyle = 'rgba(90, 70, 30, 0.10)';
  ctx.lineWidth = 28;
  ctx.stroke();

  paintChuteChannel(ctx);
  paintTitleArc(ctx);
  paintGridDecoration(ctx);
  paintHoles(ctx);
  paintGutter(ctx);
  paintNails(ctx);
  ctx.restore();

  // Chrome arch rail on top of the clipped field
  paintArchRail(ctx);
}

function paintChromeFrame(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // chrome ring around the canvas edge (the field is painted over its inside)
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_W, CANVAS_H);
  ctx.rect(FRAME_W, FRAME_W, CANVAS_W - FRAME_W * 2, CANVAS_H - FRAME_W * 2);
  const g = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  g.addColorStop(0, C.chromeLight);
  g.addColorStop(0.4, C.chromeMid);
  g.addColorStop(0.6, C.chromeLight);
  g.addColorStop(1, C.chromeDark);
  ctx.fillStyle = g;
  ctx.fill('evenodd');
  ctx.restore();
}

function paintArchRail(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  fieldPath(ctx, 0);
  ctx.clip();
  // chrome band hugging the arch from inside
  ctx.beginPath();
  ctx.arc(ARCH_CX, ARCH_CY, ARCH_R + 5, Math.PI, Math.PI * 2);
  ctx.strokeStyle = C.chromeMid;
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ARCH_CX, ARCH_CY, ARCH_R + 4, Math.PI, Math.PI * 2);
  ctx.strokeStyle = C.chromeLight;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ARCH_CX, ARCH_CY, ARCH_R - 1, Math.PI, Math.PI * 2);
  ctx.strokeStyle = 'rgba(40,40,40,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function paintChuteChannel(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // channel background, slightly shaded
  const g = ctx.createLinearGradient(CHUTE_INNER_X, 0, CANVAS_W, 0);
  g.addColorStop(0, 'rgba(120, 95, 40, 0.16)');
  g.addColorStop(0.5, 'rgba(120, 95, 40, 0.05)');
  g.addColorStop(1, 'rgba(120, 95, 40, 0.20)');
  ctx.fillStyle = g;
  ctx.fillRect(CHUTE_INNER_X, CHUTE_WALL_TOP - 30, CANVAS_W - CHUTE_INNER_X, CANVAS_H);

  // chrome divider wall with rounded top
  const wallX = CHUTE_INNER_X - 3;
  const wg = ctx.createLinearGradient(wallX, 0, wallX + 6, 0);
  wg.addColorStop(0, C.chromeDark);
  wg.addColorStop(0.5, C.chromeLight);
  wg.addColorStop(1, C.chromeDark);
  ctx.fillStyle = wg;
  ctx.fillRect(wallX, CHUTE_WALL_TOP, 6, CANVAS_H - CHUTE_WALL_TOP);
  ctx.beginPath();
  ctx.arc(wallX + 3, CHUTE_WALL_TOP, 3, 0, Math.PI * 2);
  ctx.fillStyle = C.chromeMid;
  ctx.fill();

  // yellow launcher plate at the bottom of the chute
  const px = CHUTE_INNER_X + 4;
  const pw = CANVAS_W - FRAME_W - px - 1;
  const py = LAUNCH_Y - 52;
  const ph = CANVAS_H - FRAME_W - py - 2;
  const pg = ctx.createLinearGradient(0, py, 0, py + ph);
  pg.addColorStop(0, C.plate);
  pg.addColorStop(1, C.plateDark);
  ctx.fillStyle = pg;
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 80, 0, 0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.stroke();

  // launcher mouth
  ctx.beginPath();
  ctx.arc(LAUNCH_X, LAUNCH_Y, BALL_RADIUS + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#241D10';
  ctx.fill();
  ctx.restore();
}

function paintTitleArc(ctx: CanvasRenderingContext2D): void {
  const text = 'スマートボール';
  const colors = ['#E0564A', '#4D8FCC', '#F0A33A', '#5BA86A', '#E0564A', '#4D8FCC', '#F0A33A'];
  const radius = ARCH_R - 38;
  const span = 1.18; // radians of arc covered by the title
  const start = -Math.PI / 2 - span / 2;
  ctx.save();
  ctx.font = '900 30px "RocknRoll One", "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < text.length; i++) {
    const a = start + (span * (i + 0.5)) / text.length;
    const x = ARCH_CX + Math.cos(a) * radius;
    const y = ARCH_CY + Math.sin(a) * radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(text[i], 0, 0);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function paintGridDecoration(ctx: CanvasRenderingContext2D): void {
  const first = holePosition(0, 0);
  const last = holePosition(GRID_SIZE - 1, GRID_SIZE - 1);
  const bandW = 13;

  ctx.save();
  // vertical blue bands along each column
  for (let c = 0; c < GRID_SIZE; c++) {
    const { x } = holePosition(0, c);
    const g = ctx.createLinearGradient(x - bandW / 2, 0, x + bandW / 2, 0);
    g.addColorStop(0, C.blueBandDark);
    g.addColorStop(0.5, C.blueBand);
    g.addColorStop(1, C.blueBandDark);
    ctx.fillStyle = g;
    roundRect(ctx, x - bandW / 2, first.y - 24, bandW, last.y - first.y + 48, bandW / 2);
    ctx.fill();
  }
  // horizontal red bands along each row
  for (let r = 0; r < GRID_SIZE; r++) {
    const { y } = holePosition(r, 0);
    const g = ctx.createLinearGradient(0, y - bandW / 2, 0, y + bandW / 2);
    g.addColorStop(0, C.redBand);
    g.addColorStop(1, C.redBandDark);
    ctx.fillStyle = g;
    roundRect(ctx, first.x - 24, y - bandW / 2, last.x - first.x + 48, bandW, bandW / 2);
    ctx.fill();
  }

  // yellow diamonds at the inner crossings between holes
  for (let r = 0; r < GRID_SIZE - 1; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      const a = holePosition(r, c);
      const x = a.x + HOLE_SPACING / 2;
      const y = a.y + HOLE_SPACING / 2;
      const big = r === 1 && c === 1 ? 0 : 1; // skip exact center: pinwheel there
      if (big) drawDiamond(ctx, x, y, 9, 16);
    }
  }
  // pinwheel star at board center
  const cx = (first.x + last.x) / 2;
  const cy = (first.y + last.y) / 2;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2 * (i === 0 ? 0 : 1));
    drawDiamond(ctx, 0, -15, 8, 14);
  }
  ctx.restore();
  ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w, y);
  ctx.closePath();
  ctx.fillStyle = C.gold;
  ctx.fill();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function paintHoles(ctx: CanvasRenderingContext2D): void {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const { x, y } = holePosition(r, c);
      // gold ring
      const ring = ctx.createRadialGradient(x - 3, y - 4, HOLE_RADIUS * 0.4, x, y, HOLE_RADIUS + 6);
      ring.addColorStop(0, '#FBE49A');
      ring.addColorStop(0.7, C.gold);
      ring.addColorStop(1, C.goldDark);
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS + 6, 0, Math.PI * 2);
      ctx.fillStyle = ring;
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 80, 0, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // hole pit
      const pit = ctx.createRadialGradient(x, y + 4, 2, x, y, HOLE_RADIUS);
      pit.addColorStop(0, C.holeDeep);
      pit.addColorStop(0.75, C.holeMid);
      pit.addColorStop(1, '#566049');
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = pit;
      ctx.fill();
      // upper inner shadow = depth
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS - 1, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function paintGutter(ctx: CanvasRenderingContext2D): void {
  // dark drain slot at the bottom of the field
  const y = CANVAS_H - FRAME_W - 16;
  const g = ctx.createLinearGradient(0, y - 24, 0, y + 16);
  g.addColorStop(0, 'rgba(40, 30, 10, 0)');
  g.addColorStop(1, 'rgba(40, 30, 10, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(FRAME_W, y - 24, CHUTE_INNER_X - FRAME_W - 4, 40);
  ctx.fillStyle = '#241D10';
  roundRect(ctx, FRAME_W + 14, y + 2, CHUTE_INNER_X - FRAME_W - 34, 10, 5);
  ctx.fill();
}

function paintNails(ctx: CanvasRenderingContext2D): void {
  for (const { x, y } of nailPositions()) {
    // shadow
    ctx.beginPath();
    ctx.ellipse(x + 1.5, y + 2.5, NAIL_RADIUS + 1, NAIL_RADIUS, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60, 45, 15, 0.30)';
    ctx.fill();
    // pin head
    const g = ctx.createRadialGradient(x - 1.2, y - 1.2, 0.5, x, y, NAIL_RADIUS + 0.5);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.5, '#D8DCE0');
    g.addColorStop(1, '#82878D');
    ctx.beginPath();
    ctx.arc(x, y, NAIL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(50, 55, 60, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

export function drawMarble(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, tintIndex = 0, withShadow = true,
): void {
  const [light, mid, dark] = MARBLE_TINTS[tintIndex % MARBLE_TINTS.length];
  if (withShadow) {
    ctx.beginPath();
    ctx.ellipse(x + 2, y + r * 0.55, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(50, 40, 15, 0.28)';
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.25, light);
  g.addColorStop(0.7, mid);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // specular dot
  ctx.beginPath();
  ctx.arc(x - r * 0.38, y - r * 0.42, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  // bottom bounce light
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, Math.PI * 0.25, Math.PI * 0.75);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = r * 0.16;
  ctx.stroke();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: PhysicsWorld,
  board: Board,
  ballReady: boolean,
): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.drawImage(getBoardLayer(), 0, 0, CANVAS_W, CANVAS_H);

  // marbles resting in holes
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!board[r][c]) continue;
      const { x, y } = holePosition(r, c);
      drawMarble(ctx, x, y + 1, BALL_RADIUS, (r * GRID_SIZE + c) % MARBLE_TINTS.length, false);
    }
  }

  // ball waiting at the launcher
  if (ballReady) {
    drawMarble(ctx, LAUNCH_X, LAUNCH_Y, BALL_RADIUS, 0, false);
  }

  // flying balls
  for (const ball of world.balls) {
    if (ball.state !== 'flying') continue;
    const { x, y } = ball.body.position;
    drawMarble(ctx, x, y, BALL_RADIUS, 0, true);
  }
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
  if (wrapW === 0 || wrapH === 0) return;
  const scale = Math.min(wrapW / CANVAS_W, wrapH / CANVAS_H);
  const dispW = CANVAS_W * scale;
  const dispH = CANVAS_H * scale;

  canvas.style.width = `${dispW}px`;
  canvas.style.height = `${dispH}px`;
  canvas.style.position = 'absolute';
  canvas.style.left = `${(wrapW - dispW) / 2}px`;
  canvas.style.top = `${(wrapH - dispH) / 2}px`;

  // Actual pixel resolution (devicePixelRatio aware, capped for performance)
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(dispW * dpr);
  canvas.height = Math.round(dispH * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(canvas.width / CANVAS_W, 0, 0, canvas.height / CANVAS_H, 0, 0);
}
