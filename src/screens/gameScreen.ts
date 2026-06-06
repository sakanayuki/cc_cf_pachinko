import { CANVAS_H, TOTAL_BALLS, MAX_PULL } from '../game/constants';
import { createBoard, fillCell, countLines, Board } from '../game/board';
import { createPhysicsWorld, launchBall, stepWorld, destroyWorld, PhysicsWorld, PhysicsBall } from '../game/physics';
import { drawFrame, resizeCanvas } from '../game/renderer';
import { sfx, resumeAudio } from '../audio/sfx';

export function renderGameScreen(onEnd: (score: number, board: Board) => void): HTMLElement {
  const el = document.createElement('div');
  el.id = 'screen-game';
  el.className = 'screen';

  el.innerHTML = `
    <div class="game-header">
      <button class="btn btn-give-up" id="btn-give-up">あきらめる</button>
      <div class="game-score-header" id="score-header">0 列</div>
    </div>
    <div id="canvas-wrapper">
      <canvas id="game-canvas"></canvas>
    </div>
    <div class="game-footer">
      <div class="balls-remaining" id="balls-remaining">のこり <span id="ball-count">${TOTAL_BALLS}</span></div>
      <div class="launcher-area" id="launcher-area">
        <div class="launcher-track"></div>
        <div class="power-gauge" id="power-gauge">
          <div class="power-gauge-fill" id="power-fill"></div>
        </div>
        <div class="launcher-btn" id="launcher-btn">▲</div>
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
  let canLaunch = true; // one ball at a time
  let ended = false;
  let nailSfxCooldown = 0;

  function updateUI(): void {
    el.querySelector<HTMLElement>('#ball-count')!.textContent = String(ballsRemaining);
    el.querySelector<HTMLElement>('#score-header')!.textContent = `${currentLines} 列`;
  }

  function endGame(): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(rafId);
    sfx.end();
    if (physicsWorld) destroyWorld(physicsWorld);
    onEnd(currentLines, board);
  }

  function onBallSettled(_ball: PhysicsBall, row: number, col: number): void {
    if (board[row][col]) return; // already filled
    const prevLines = currentLines;
    board = fillCell(board, row, col);
    currentLines = countLines(board);
    sfx.hole();
    if (currentLines > prevLines) sfx.bingo();
    updateUI();
    scheduleNextLaunch();
  }

  function onBallRemoved(_ball: PhysicsBall): void {
    scheduleNextLaunch();
  }

  function scheduleNextLaunch(): void {
    canLaunch = true;
    if (ballsRemaining <= 0) {
      setTimeout(endGame, 600);
    }
  }

  // ---- Physics init (deferred until DOM ready) ----
  function initPhysics(): void {
    physicsWorld = createPhysicsWorld(onBallSettled, onBallRemoved);
  }

  // ---- Game loop ----
  function gameLoop(ts: number): void {
    if (ended) return;
    rafId = requestAnimationFrame(gameLoop);

    const delta = Math.min(ts - lastTime, 50);
    lastTime = ts;

    if (physicsWorld) {
      stepWorld(physicsWorld, delta);
      nailSfxCooldown = Math.max(0, nailSfxCooldown - delta);

      // Nail collision sound (throttled)
      if (nailSfxCooldown === 0) {
        for (const b of physicsWorld.balls) {
          if (b.state === 'flying') {
            const speed = Math.hypot(b.body.velocity.x, b.body.velocity.y);
            if (speed < 1.5 && b.body.position.y < CANVAS_H - 40) {
              // Ball is nearly stopped but still in play – nudge to prevent stalling
              // (not a nail hit, just prevention)
            }
          }
        }
      }

      const canvas = el.querySelector<HTMLCanvasElement>('#game-canvas')!;
      const ctx = canvas.getContext('2d')!;
      // Save/restore scale set by resizeCanvas
      ctx.save();
      drawFrame(ctx, physicsWorld, board);
      ctx.restore();
    }
  }

  // ---- Launcher interaction ----
  function setupLauncher(): void {
    const launcherBtn = el.querySelector<HTMLElement>('#launcher-btn')!;
    const powerFill = el.querySelector<HTMLElement>('#power-fill')!;

    launcherBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!canLaunch || ballsRemaining <= 0 || ended) return;
      resumeAudio();
      pulling = true;
      pullStartY = e.clientY;
      pullCurrent = 0;
      launcherBtn.classList.add('pulling');
      launcherBtn.setPointerCapture(e.pointerId);
    });

    launcherBtn.addEventListener('pointermove', (e) => {
      if (!pulling) return;
      e.preventDefault();
      const dy = e.clientY - pullStartY;
      pullCurrent = Math.max(0, Math.min(dy, MAX_PULL));
      const pct = (pullCurrent / MAX_PULL) * 100;
      powerFill.style.height = `${pct}%`;
    });

    const release = (e: PointerEvent) => {
      if (!pulling) return;
      e.preventDefault();
      pulling = false;
      launcherBtn.classList.remove('pulling');
      powerFill.style.height = '0%';

      if (pullCurrent < 5 || !canLaunch || ballsRemaining <= 0 || ended) return;

      const power = pullCurrent / MAX_PULL;
      canLaunch = false;
      ballsRemaining--;
      updateUI();
      sfx.launch();

      if (physicsWorld) launchBall(physicsWorld, power);
    };

    launcherBtn.addEventListener('pointerup', release);
    launcherBtn.addEventListener('pointercancel', release);
  }

  // ---- Resize handling ----
  function setupCanvas(): void {
    const canvas = el.querySelector<HTMLCanvasElement>('#game-canvas')!;
    resizeCanvas(canvas);

    const ro = new ResizeObserver(() => resizeCanvas(canvas));
    ro.observe(el.querySelector('#canvas-wrapper')!);
  }

  // ---- Give up button ----
  el.querySelector('#btn-give-up')!.addEventListener('pointerup', (e) => {
    e.preventDefault();
    endGame();
  });

  // ---- Lifecycle ----
  // Use a small timeout so the element is mounted before querying sizes
  requestAnimationFrame(() => {
    setupCanvas();
    initPhysics();
    setupLauncher();
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  });

  return el;
}
