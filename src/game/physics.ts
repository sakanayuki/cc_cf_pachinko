import Matter from 'matter-js';
import {
  CANVAS_W, CANVAS_H, BALL_RADIUS, NAIL_RADIUS,
  BALL_RESTITUTION, NAIL_RESTITUTION, WALL_RESTITUTION,
  BALL_FRICTION, BALL_FRICTION_AIR, GRAVITY,
  FRAME_W, CHUTE_INNER_X, CHUTE_WALL_TOP,
  ARCH_CX, ARCH_CY, ARCH_R,
  HOLE_SPACING, HOLE_CAPTURE_DIST, HOLE_ATTRACT_DIST, HOLE_ATTRACT_FORCE,
  MIN_LAUNCH_SPEED, MAX_LAUNCH_SPEED, LAUNCH_JITTER,
  STALL_SPEED, STALL_NUDGE_MS, STALL_REMOVE_MS,
  GRID_SIZE,
} from './constants';
import { holePosition } from './board';

const { Engine, World, Bodies, Body, Events, Common } = Matter;

export interface PhysicsBall {
  body: Matter.Body;
  state: 'flying' | 'settled' | 'removed';
  settledRow?: number;
  settledCol?: number;
  stallMs: number;
  lifeMs: number;
}

export interface PhysicsWorld {
  engine: Matter.Engine;
  balls: PhysicsBall[];
  nailBodies: Matter.Body[];
  accumulator: number;
  isHoleFilled: (row: number, col: number) => boolean;
  onBallSettled: (ball: PhysicsBall, row: number, col: number) => void;
  /** refunded = the ball rolled back down the launch chute and is returned to the player */
  onBallRemoved: (ball: PhysicsBall, refunded: boolean) => void;
  onNailHit: (speed: number) => void;
}

const FIXED_DT = 1000 / 120;

export function nailPositions(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const colX = (c: number) => holePosition(0, c).x;
  const rowY = (r: number) => holePosition(r, 0).y;
  const midX = [
    (colX(0) + colX(1)) / 2,
    (colX(1) + colX(2)) / 2,
    (colX(2) + colX(3)) / 2,
  ];
  const outerL = colX(0) - HOLE_SPACING / 2;
  const outerR = colX(3) + HOLE_SPACING / 2;

  // Entry scatter under the arch (two staggered rows)
  for (const x of [55, 120, 185, 250, 315]) pts.push({ x, y: 152 });
  for (const x of [88, 153, 218, 283]) pts.push({ x, y: 192 });

  // Funnel lines above each hole row + one below the last row.
  // Nails sit exactly between hole columns so balls are funnelled into holes.
  for (let r = 0; r <= GRID_SIZE; r++) {
    const y = rowY(0) - HOLE_SPACING / 2 + r * HOLE_SPACING;
    for (const x of [outerL, ...midX, outerR]) pts.push({ x, y });
  }

  // Side deflectors keep balls from hugging the walls
  for (const y of [rowY(0) + HOLE_SPACING / 2, rowY(2) + HOLE_SPACING / 2]) {
    pts.push({ x: 16, y });
    pts.push({ x: CHUTE_INNER_X - 16, y });
  }

  // Bottom bumpers above the out gutter
  for (const x of midX) pts.push({ x, y: rowY(3) + HOLE_SPACING + 36 });

  return pts;
}

function buildNails(): Matter.Body[] {
  return nailPositions().map(({ x, y }) =>
    Bodies.circle(x, y, NAIL_RADIUS, {
      isStatic: true,
      restitution: NAIL_RESTITUTION,
      friction: 0,
      label: 'nail',
    })
  );
}

function buildArchRail(): Matter.Body[] {
  // Outer guide rail along the top arch. The ball rides it from the chute
  // mouth over the apex and into the playfield.
  const segments: Matter.Body[] = [];
  const thetaRight = Math.acos((CANVAS_W - ARCH_CX) / ARCH_R);  // ~30deg
  const thetaLeft = Math.PI - thetaRight;                        // ~150deg
  const N = 26;
  const thickness = 14;
  const rMid = ARCH_R + thickness / 2;
  for (let i = 0; i < N; i++) {
    const t0 = thetaRight + ((thetaLeft - thetaRight) * i) / N;
    const t1 = thetaRight + ((thetaLeft - thetaRight) * (i + 1)) / N;
    const x0 = ARCH_CX + Math.cos(t0) * ARCH_R;
    const y0 = ARCH_CY - Math.sin(t0) * ARCH_R;
    const x1 = ARCH_CX + Math.cos(t1) * ARCH_R;
    const y1 = ARCH_CY - Math.sin(t1) * ARCH_R;
    const mt = (t0 + t1) / 2;
    const cx = ARCH_CX + Math.cos(mt) * rMid;
    const cy = ARCH_CY - Math.sin(mt) * rMid;
    const len = Math.hypot(x1 - x0, y1 - y0) + 3;
    const angle = Math.atan2(y1 - y0, x1 - x0);
    segments.push(
      Bodies.rectangle(cx, cy, len, thickness, {
        isStatic: true,
        angle,
        restitution: 0.05,
        friction: 0,
        label: 'rail',
      })
    );
  }
  return segments;
}

function buildWalls(): Matter.Body[] {
  const thick = 40;
  const opt = (label: string) => ({
    isStatic: true,
    restitution: WALL_RESTITUTION,
    friction: 0,
    label,
  });
  return [
    // left / right outer walls (inset to the visible frame's inner edge)
    Bodies.rectangle(FRAME_W - thick / 2, CANVAS_H / 2, thick, CANVAS_H * 2, opt('wall')),
    Bodies.rectangle(CANVAS_W - FRAME_W + thick / 2, CANVAS_H / 2, thick, CANVAS_H * 2, opt('wall')),
    // safety ceiling far above the arch
    Bodies.rectangle(CANVAS_W / 2, -thick, CANVAS_W * 2, thick, opt('wall')),
    // launch chute inner wall (open at the top so the ball exits onto the arch)
    Bodies.rectangle(
      CHUTE_INNER_X - 3,
      (CHUTE_WALL_TOP + CANVAS_H) / 2,
      6,
      CANVAS_H - CHUTE_WALL_TOP,
      opt('chute')
    ),
  ];
}

export function createPhysicsWorld(
  isHoleFilled: PhysicsWorld['isHoleFilled'],
  onBallSettled: PhysicsWorld['onBallSettled'],
  onBallRemoved: PhysicsWorld['onBallRemoved'],
  onNailHit: PhysicsWorld['onNailHit'],
): PhysicsWorld {
  const engine = Engine.create();
  engine.gravity.y = GRAVITY;

  const nailBodies = buildNails();
  World.add(engine.world, [...buildWalls(), ...buildArchRail(), ...nailBodies]);

  const world: PhysicsWorld = {
    engine,
    balls: [],
    nailBodies,
    accumulator: 0,
    isHoleFilled,
    onBallSettled,
    onBallRemoved,
    onNailHit,
  };

  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const nail = bodyA.label === 'nail' ? bodyA : bodyB.label === 'nail' ? bodyB : null;
      const ballBody = bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : null;
      if (nail && ballBody) {
        const speed = Math.hypot(ballBody.velocity.x, ballBody.velocity.y);
        if (speed > 0.8) world.onNailHit(speed);
      }
    }
  });

  return world;
}

export const LAUNCH_X = (CHUTE_INNER_X + CANVAS_W - FRAME_W) / 2;
export const LAUNCH_Y = CANVAS_H - 40;

export function launchBall(world: PhysicsWorld, power: number): PhysicsBall {
  const startX = LAUNCH_X;
  const startY = LAUNCH_Y;

  const body = Bodies.circle(startX, startY, BALL_RADIUS, {
    restitution: BALL_RESTITUTION,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    density: 0.002,
    label: 'ball',
  });

  World.add(world.engine.world, body);

  const speed =
    MIN_LAUNCH_SPEED +
    power * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED) +
    Common.random(-LAUNCH_JITTER, LAUNCH_JITTER);
  Body.setVelocity(body, { x: 0, y: -speed });

  const ball: PhysicsBall = { body, state: 'flying', stallMs: 0, lifeMs: 0 };
  world.balls.push(ball);
  return ball;
}

function settleBall(world: PhysicsWorld, ball: PhysicsBall, row: number, col: number): void {
  ball.state = 'settled';
  ball.settledRow = row;
  ball.settledCol = col;
  Body.setVelocity(ball.body, { x: 0, y: 0 });
  Body.setStatic(ball.body, true);
  Body.setPosition(ball.body, holePosition(row, col));
  world.onBallSettled(ball, row, col);
}

function removeBall(world: PhysicsWorld, ball: PhysicsBall, refunded: boolean): void {
  ball.state = 'removed';
  World.remove(world.engine.world, ball.body);
  world.onBallRemoved(ball, refunded);
}

function updateFlyingBall(world: PhysicsWorld, ball: PhysicsBall, dt: number): void {
  const body = ball.body;
  const { x, y } = body.position;
  ball.lifeMs += dt;

  // Out the bottom: lost ball, unless it rolled back down the launch chute,
  // in which case it is returned to the player.
  if (y > CANVAS_H + BALL_RADIUS * 2) {
    removeBall(world, ball, x > CHUTE_INNER_X);
    return;
  }

  // Hole capture + attraction (only inside the playfield)
  if (x < CHUTE_INNER_X) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (world.isHoleFilled(r, c)) continue;
        const hp = holePosition(r, c);
        const dx = hp.x - x;
        const dy = hp.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < HOLE_CAPTURE_DIST * HOLE_CAPTURE_DIST) {
          settleBall(world, ball, r, c);
          return;
        }
        if (d2 < HOLE_ATTRACT_DIST * HOLE_ATTRACT_DIST) {
          const d = Math.sqrt(d2) || 1;
          Body.applyForce(body, body.position, {
            x: (dx / d) * HOLE_ATTRACT_FORCE,
            y: (dy / d) * HOLE_ATTRACT_FORCE,
          });
        }
      }
    }
  }

  // Anti-stall: balls resting on nails get nudged, hopeless ones are recycled
  const speed = Math.hypot(body.velocity.x, body.velocity.y);
  if (speed < STALL_SPEED && ball.lifeMs > 500) {
    ball.stallMs += dt;
    if (ball.stallMs > STALL_REMOVE_MS) {
      removeBall(world, ball, false);
      return;
    }
    if (ball.stallMs % STALL_NUDGE_MS < dt) {
      Body.applyForce(body, body.position, {
        x: (Common.random(-1, 1)) * 0.0035,
        y: -0.002,
      });
    }
  } else if (speed > STALL_SPEED * 2) {
    ball.stallMs = 0;
  }
}

export function stepWorld(world: PhysicsWorld, delta: number): void {
  // Fixed-timestep accumulator keeps collisions stable at high launch speeds
  world.accumulator = Math.min(world.accumulator + delta, 100);
  while (world.accumulator >= FIXED_DT) {
    world.accumulator -= FIXED_DT;
    Engine.update(world.engine, FIXED_DT);
    for (const ball of world.balls) {
      if (ball.state === 'flying') updateFlyingBall(world, ball, FIXED_DT);
    }
  }
}

export function destroyWorld(world: PhysicsWorld): void {
  Events.off(world.engine, 'collisionStart');
  World.clear(world.engine.world, false);
  Engine.clear(world.engine);
}
