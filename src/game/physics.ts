import Matter from 'matter-js';
import {
  CANVAS_W, CANVAS_H, BALL_RADIUS, NAIL_RADIUS, HOLE_RADIUS,
  BALL_RESTITUTION, NAIL_RESTITUTION, BALL_FRICTION, BALL_FRICTION_AIR,
  GRAVITY,
} from './constants';
import { holePosition } from './board';

const { Engine, World, Bodies, Body, Events } = Matter;

export interface PhysicsBall {
  body: Matter.Body;
  state: 'flying' | 'settled' | 'removed';
  settledRow?: number;
  settledCol?: number;
}

export interface HoleSensor {
  body: Matter.Body;
  row: number;
  col: number;
}

export interface PhysicsWorld {
  engine: Matter.Engine;
  balls: PhysicsBall[];
  holeSensors: HoleSensor[];
  nailBodies: Matter.Body[];
  onBallSettled: (ball: PhysicsBall, row: number, col: number) => void;
  onBallRemoved: (ball: PhysicsBall) => void;
}

// Right-side clear zone: no nails within button diameter from the right edge
const NO_NAIL_RIGHT = CANVAS_W - 56;

function buildNails(): Matter.Body[] {
  const nails: Matter.Body[] = [];
  const laneNailRows = [
    [0.15, 0.3, 0.45, 0.6, 0.75, 0.88],
    [0.1, 0.25, 0.4, 0.55, 0.7, 0.85],
    [0.18, 0.33, 0.5, 0.67, 0.82],
  ];
  const laneYs = [60, 100, 140];
  laneNailRows.forEach((xs, ri) => {
    xs.forEach(xRatio => {
      const nx = xRatio * CANVAS_W;
      if (nx > NO_NAIL_RIGHT) return;
      nails.push(
        Bodies.circle(nx, laneYs[ri], NAIL_RADIUS, {
          isStatic: true,
          restitution: NAIL_RESTITUTION,
          friction: 0,
          label: 'nail',
          render: { fillStyle: '#7A4A1E' },
        })
      );
    });
  });

  const scatterPositions = [
    [0.12, 175], [0.35, 175], [0.62, 175], [0.88, 175],
    [0.22, 195], [0.5, 195], [0.77, 195],
    [0.06, 235], [0.94, 235],
    [0.06, 305], [0.94, 305],
    [0.06, 375], [0.94, 375],
    [0.15, 455], [0.38, 455], [0.62, 455], [0.85, 455],
    [0.25, 490], [0.5, 490], [0.75, 490],
  ];
  scatterPositions.forEach(([xR, y]) => {
    const nx = xR * CANVAS_W;
    if (nx > NO_NAIL_RIGHT) return;
    nails.push(
      Bodies.circle(nx, y, NAIL_RADIUS, {
        isStatic: true,
        restitution: NAIL_RESTITUTION,
        friction: 0,
        label: 'nail',
        render: { fillStyle: '#7A4A1E' },
      })
    );
  });

  return nails;
}

const CORNER_R = 40;
const CHUTE_X = CANVAS_W - 28;

function buildWalls(): Matter.Body[] {
  const thick = 20;
  const wallOpts = { isStatic: true, label: 'wall', restitution: 0.4, friction: 0, render: { fillStyle: '#7A4A1E' } };
  return [
    Bodies.rectangle(-thick / 2, CANVAS_H / 2, thick, CANVAS_H, wallOpts),
    Bodies.rectangle(CANVAS_W + thick / 2, CANVAS_H / 2, thick, CANVAS_H, wallOpts),
    Bodies.rectangle(CANVAS_W / 2, -thick / 2, CANVAS_W, thick, wallOpts),
    // Smooth corner guides — circular bodies that round the top-left and top-right corners
    Bodies.circle(CORNER_R, CORNER_R, CORNER_R, { ...wallOpts, render: { fillStyle: '#7A4A1E' } }),
    Bodies.circle(CHUTE_X - CORNER_R, CORNER_R, CORNER_R, { ...wallOpts, render: { fillStyle: '#7A4A1E' } }),
    // Launch chute left wall (separates chute from main field)
    Bodies.rectangle(CHUTE_X - thick / 2, CANVAS_H / 2, thick, CANVAS_H, wallOpts),
  ];
}

export function createPhysicsWorld(
  onBallSettled: PhysicsWorld['onBallSettled'],
  onBallRemoved: PhysicsWorld['onBallRemoved'],
): PhysicsWorld {
  const engine = Engine.create();
  engine.gravity.y = GRAVITY;

  const nailBodies = buildNails();
  const walls = buildWalls();

  const holeSensors: HoleSensor[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const { x, y } = holePosition(r, c);
      const body = Bodies.circle(x, y, HOLE_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: `hole_${r}_${c}`,
        render: { fillStyle: 'transparent' },
      });
      holeSensors.push({ body, row: r, col: c });
    }
  }

  World.add(engine.world, [
    ...walls,
    ...nailBodies,
    ...holeSensors.map(h => h.body),
  ]);

  const world: PhysicsWorld = {
    engine,
    balls: [],
    holeSensors,
    nailBodies,
    onBallSettled,
    onBallRemoved,
  };

  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      for (const [ballBody, other] of [[bodyA, bodyB], [bodyB, bodyA]] as [Matter.Body, Matter.Body][]) {
        if (ballBody.label !== 'ball') continue;
        const ball = world.balls.find(b => b.body === ballBody);
        if (!ball || ball.state !== 'flying') continue;

        if (other.label.startsWith('hole_')) {
          const parts = other.label.split('_');
          const row = parseInt(parts[1], 10);
          const col = parseInt(parts[2], 10);
          // If hole already occupied, treat it like a nail — ball bounces off
          const occupied = world.balls.some(
            b => b.state === 'settled' && b.settledRow === row && b.settledCol === col
          );
          if (occupied) continue;
          ball.state = 'settled';
          ball.settledRow = row;
          ball.settledCol = col;
          Body.setStatic(ballBody, true);
          Body.setPosition(ballBody, holePosition(row, col));
          onBallSettled(ball, row, col);
        }
      }
    }
  });

  return world;
}

export function launchBall(world: PhysicsWorld, power: number): PhysicsBall {
  // Start at the right-side lane entry, near the bottom-right
  const startX = CANVAS_W - BALL_RADIUS - 10;
  const startY = CANVAS_H - 80;

  const body = Bodies.circle(startX, startY, BALL_RADIUS, {
    restitution: BALL_RESTITUTION,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    label: 'ball',
    render: { fillStyle: '#FFFFFF' },
  });

  World.add(world.engine.world, body);

  // Launch direction: up-left arc
  const angle = Math.PI * (0.62 + 0.1 * (1 - power)); // steeper when more power
  const speed = 8 + power * 14;
  Body.setVelocity(body, {
    x: -Math.cos(angle) * speed,
    y: -Math.sin(angle) * speed,
  });

  const ball: PhysicsBall = { body, state: 'flying' };
  world.balls.push(ball);
  return ball;
}

export function stepWorld(world: PhysicsWorld, delta: number): void {
  Engine.update(world.engine, delta);

  // Check if any flying balls have left the canvas bottom
  for (const ball of world.balls) {
    if (ball.state !== 'flying') continue;
    if (ball.body.position.y > CANVAS_H + BALL_RADIUS * 2) {
      ball.state = 'removed';
      World.remove(world.engine.world, ball.body);
      world.onBallRemoved(ball);
    }
  }
}

export function destroyWorld(world: PhysicsWorld): void {
  World.clear(world.engine.world, false);
  Engine.clear(world.engine);
}
