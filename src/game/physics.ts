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

function buildNails(): Matter.Body[] {
  const nails: Matter.Body[] = [];
  // Upper curved lane nails: two rows fanning the path
  const laneNailRows = [
    // row y=60: fan across top
    [0.15, 0.3, 0.45, 0.6, 0.75, 0.88],
    // row y=100
    [0.1, 0.25, 0.4, 0.55, 0.7, 0.85],
    // row y=140
    [0.18, 0.33, 0.5, 0.67, 0.82],
  ];
  const laneYs = [60, 100, 140];
  laneNailRows.forEach((xs, ri) => {
    xs.forEach(xRatio => {
      nails.push(
        Bodies.circle(xRatio * CANVAS_W, laneYs[ri], NAIL_RADIUS, {
          isStatic: true,
          restitution: NAIL_RESTITUTION,
          friction: 0,
          label: 'nail',
          render: { fillStyle: '#7A4A1E' },
        })
      );
    });
  });

  // Scatter nails between and around the hole grid (y 170-440)
  const scatterPositions = [
    // above grid
    [0.12, 175], [0.35, 175], [0.62, 175], [0.88, 175],
    [0.22, 195], [0.5, 195], [0.77, 195],
    // sides between hole rows
    [0.06, 235], [0.94, 235],
    [0.06, 305], [0.94, 305],
    [0.06, 375], [0.94, 375],
    // below grid
    [0.15, 455], [0.38, 455], [0.62, 455], [0.85, 455],
    [0.25, 490], [0.5, 490], [0.75, 490],
  ];
  scatterPositions.forEach(([xR, y]) => {
    nails.push(
      Bodies.circle(xR * CANVAS_W, y, NAIL_RADIUS, {
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

function buildWalls(): Matter.Body[] {
  const thick = 20;
  return [
    // left wall
    Bodies.rectangle(-thick / 2, CANVAS_H / 2, thick, CANVAS_H, {
      isStatic: true, label: 'wall', render: { fillStyle: '#7A4A1E' },
    }),
    // right wall
    Bodies.rectangle(CANVAS_W + thick / 2, CANVAS_H / 2, thick, CANVAS_H, {
      isStatic: true, label: 'wall', render: { fillStyle: '#7A4A1E' },
    }),
    // top wall
    Bodies.rectangle(CANVAS_W / 2, -thick / 2, CANVAS_W, thick, {
      isStatic: true, label: 'wall', render: { fillStyle: '#7A4A1E' },
    }),
    // angled left guide (upper launch lane)
    Bodies.rectangle(CANVAS_W * 0.08, 40, CANVAS_W * 0.16, 8, {
      isStatic: true,
      angle: Math.PI / 12,
      label: 'wall',
      render: { fillStyle: '#A9743B' },
    }),
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
