import { TOTAL_BALLS, MAX_PULL, CHUTE_INNER_X } from '../game/constants';
import { createBoard, fillCell, countLines, Board } from '../game/board';
import {
  createPhysicsWorld, launchBall, stepWorld, destroyWorld,
  PhysicsWorld, PhysicsBall,
} from '../game/physics';
import { drawFrame, resizeCanvas, invalidateBoardLayer } from '../game/renderer';
import { sfx, resumeAudio } from '../audio/sfx';

export function renderGameScreen(onEnd: (score: number, board: Board) => void): HTMLElement {
  const el = document.createElement('div');
  el.id = 'screen-game';
  el.className = 'screen';

  el.innerHTML = `
    <div class="game-header">
      <button class="btn btn-give-up" id="btn-give-up">あきらめる</button>
      <div class="game-lines" id="score-header">そろった列 <span class="lines-num" id="lines-num">0</span></div>
    </div>
    <div id="canvas-wrapper">
      <canvas id="game-canvas"></canvas>
      <div class="refund-toast" id="refund-toast">玉が戻りました</div>
    </div>
    <div class="game-footer">
      <div class="ball-tray">
        <div class="balls-remaining">のこり <span id="ball-count">${TOTAL_BALLS}</span> 球</div>
        <div class="tray-dots" id="tray-dots"></div>
      </div>
      <div class="launcher-area" id="launcher-area">
        <div class="launcher-slot"></div>
        <div class="power-gauge"><div class="power-gauge-fill" id="power-fill"></div></div>
        <div class="launcher-knob" id="launcher-knob"><span>ひく</span></div>
      </div>
    </div>
  `;

  // ---- State ----
  let board = createBoard();
  let ballsRemaining = TOTAL_BALLS;
  let currentLines = 0;
  let physicsWorld: PhysicsWorld | null = null;
  let rafId = 0;
  let lastTime = 0;
  let pulling = false;
  let pullStartY = 0;
  let pullCurrent = 0;
  let ended = false;
  let nailSfxAt = 0;
  let canvasCtx: CanvasRenderingContext2D | null = null;

  // ---- UI ----
  const trayDots = el.querySelector<HTMLElement>('#tray-dots')!;
  for (let i = 0; i < TOTAL_BALLS; i++) {
    const d = document.createElement('div');
    d.className = 'tray-dot';
    trayDots.appendChild(d);
  }

  function updateUI(): void {
    el.querySelector<HTMLElement>('#ball-count')!.textContent = String(ballsRemaining);
    el.querySelector<HTMLElement>('#lines-num')!.textContent = String(currentLines);
    trayDots.querySelectorAll<HTMLElement>('.tray-dot').forEach((d, i) => {
      d.classList.toggle('used', i >= ballsRemaining);
    });
  }

  let toastTimer = 0;
  function showRefundToast(): void {
    const toast = el.querySelector<HTMLElement>('#refund-toast')!;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1400);
  }

  function endGame(): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(rafId);
    sfx.end();
    if (physicsWorld) destroyWorld(physicsWorld);
    onEnd(currentLines, board);
  }

  // The launch chute must be empty before the next ball can be loaded
  // (a rising or rolled-back ball still occupies it). Balls already in the
  // playfield don't block the launcher.
  function chuteClear(): boolean {
    if (!physicsWorld) return false;
    return physicsWorld.balls.every(
      b => b.state !== 'flying' || b.body.position.x < CHUTE_INNER_X
    );
  }

  function canLaunch(): boolean {
    return !ended && ballsRemaining > 0 && chuteClear();
  }

  // ---- Physics callbacks ----
  function isHoleFilled(row: number, col: number): boolean {
    return board[row][col];
  }

  function onBallSettled(_ball: PhysicsBall, row: number, col: number): void {
    const prevLines = currentLines;
    board = fillCell(board, row, col);
    currentLines = countLines(board);
    sfx.hole();
    if (currentLines > prevLines) sfx.bingo();
    updateUI();
    maybeEndGame();
  }

  function onBallRemoved(_ball: PhysicsBall, refunded: boolean): void {
    if (refunded) {
      ballsRemaining++;
      sfx.refund();
      showRefundToast();
      updateUI();
    } else {
      sfx.out();
    }
    maybeEndGame();
  }

  function onNailHit(_speed: number): void {
    const now = performance.now();
    if (now - nailSfxAt > 70) {
      nailSfxAt = now;
      sfx.nail();
    }
  }

  function maybeEndGame(): void {
    const anyFlying = physicsWorld?.balls.some(b => b.state === 'flying') ?? false;
    if (ballsRemaining <= 0 && !anyFlying) {
      setTimeout(endGame, 900);
    }
  }

  // ---- Game loop ----
  function gameLoop(ts: number): void {
    if (ended) return;
    rafId = requestAnimationFrame(gameLoop);

    const delta = Math.min(ts - lastTime, 50);
    lastTime = ts;

    if (physicsWorld && canvasCtx) {
      stepWorld(physicsWorld, delta);
      drawFrame(canvasCtx, physicsWorld, board, canLaunch());
    }
  }

  // ---- Launcher interaction ----
  function setupLauncher(): void {
    const knob = el.querySelector<HTMLElement>('#launcher-knob')!;
    const powerFill = el.querySelector<HTMLElement>('#power-fill')!;

    const setKnob = (pull: number): void => {
      knob.style.transform = `translateX(-50%) translateY(${pull * 0.42}px)`;
      powerFill.style.height = `${(pull / MAX_PULL) * 100}%`;
    };

    knob.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (ended) return;
      resumeAudio();
      pulling = true;
      pullStartY = e.clientY;
      pullCurrent = 0;
      knob.classList.add('pulling');
      knob.setPointerCapture(e.pointerId);
    });

    knob.addEventListener('pointermove', (e) => {
      if (!pulling) return;
      e.preventDefault();
      pullCurrent = Math.max(0, Math.min(e.clientY - pullStartY, MAX_PULL));
      setKnob(pullCurrent);
    });

    const release = (e: PointerEvent): void => {
      if (!pulling) return;
      e.preventDefault();
      pulling = false;
      knob.classList.remove('pulling');
      setKnob(0);

      if (pullCurrent < 8 || !canLaunch()) {
        pullCurrent = 0;
        return;
      }

      const power = pullCurrent / MAX_PULL;
      pullCurrent = 0;
      ballsRemaining--;
      updateUI();
      sfx.launch();
      if (physicsWorld) launchBall(physicsWorld, power);
    };

    knob.addEventListener('pointerup', release);
    knob.addEventListener('pointercancel', release);
  }

  // ---- Canvas / resize ----
  function setupCanvas(): void {
    const canvas = el.querySelector<HTMLCanvasElement>('#game-canvas')!;
    resizeCanvas(canvas);
    canvasCtx = canvas.getContext('2d')!;

    const ro = new ResizeObserver(() => {
      resizeCanvas(canvas);
      canvasCtx = canvas.getContext('2d')!;
    });
    ro.observe(el.querySelector('#canvas-wrapper')!);
  }

  // Re-render the cached board layer once webfonts are in (arch title)
  document.fonts?.ready.then(() => invalidateBoardLayer());

  el.querySelector('#btn-give-up')!.addEventListener('pointerup', (e) => {
    e.preventDefault();
    endGame();
  });

  // ---- Lifecycle ----
  requestAnimationFrame(() => {
    setupCanvas();
    physicsWorld = createPhysicsWorld(isHoleFilled, onBallSettled, onBallRemoved, onNailHit);
    setupLauncher();
    updateUI();
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  });

  return el;
}
