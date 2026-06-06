import Matter from 'matter-js';
import {
  CANVAS_W, CANVAS_H, BALL_RADIUS, NAIL_RADIUS, HOLE_RADIUS,
  BALL_RESTITUTION, NAIL_RESTITUTION, BALL_FRICTION, BALL_FRICTION_AIR,
  GRAVITY, GRID_SIZE,
  MIN_LAUNCH_SPEED, MAX_LAUNCH_SPEED, LAUNCH_START_X, LAUNCH_START_Y,
  DEFLECTOR_CENTER_X, DEFLECTOR_CENTER_Y, DEFLECTOR_RADIUS, DEFLECTOR_SEGMENTS,
  DEFLECTOR_ANGLE_START, DEFLECTOR_ANGLE_END, DEFLECTOR_RESTITUTION,
  LANE_WALL_X, LANE_WALL_THICK, LANE_WALL_Y_TOP, LANE_WALL_Y_BOT,
} from './constants';
import { holePosition } from './board';

const { Engine, World, Bodies, Body, Events } = Matter;

export interface PhysicsBall {
  body: Matter.Body;
  state: 'flying' | 'settled' | 'removed';
  settledRow?: number;
  settledCol?: number;
  lowSpeedSteps?: number; // for anti-stall nudge
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

function makeNail(x: number, y: number): Matter.Body {
  return Bodies.circle(x, y, NAIL_RADIUS, {
    isStatic: true,
    restitution: NAIL_RESTITUTION,
    friction: 0,
    label: 'nail',
    render: { fillStyle: '#7A4A1E' },
  });
}

function buildNails(): Matter.Body[] {
  const nails: Matter.Body[] = [];

  // Guide nails ("inochi-kugi") flanking each hole: two nails just above the
  // opening of every hole so balls funnel in. Spaced ±19px (gap 38 > ball
  // diameter 28) so a ball cannot rest bridged across them.
  const holeCenters: { x: number; y: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const h = holePosition(r, c);
      holeCenters.push(h);
      nails.push(makeNail(h.x - 19, h.y - 21));
      nails.push(makeNail(h.x + 19, h.y - 21));
    }
  }

  // Scatter nails above and to the left of the grid to vary bounces. Nothing is
  // placed below the bottom hole row (it would serve no purpose there).
  const scatterPositions: [number, number][] = [
    // above grid
    [0.12, 170], [0.30, 170], [0.48, 170], [0.66, 170], [0.84, 170],
    [0.20, 192], [0.38, 192], [0.56, 192], [0.74, 192],
    // left side between hole rows
    [0.06, 235], [0.06, 305], [0.06, 375],
  ];
  scatterPositions.forEach(([xR, y]) => {
    nails.push(makeNail(xR * CANVAS_W, y));
  });

  // Drop any nail that overlaps a hole, or that sits inside the launch lane
  // (where it would block the rising ball).
  const margin = HOLE_RADIUS + NAIL_RADIUS + 2;
  return nails.filter(n =>
    n.position.x < LANE_WALL_X - NAIL_RADIUS - 8 &&
    holeCenters.every(h => Math.hypot(n.position.x - h.x, n.position.y - h.y) >= margin)
  );
}

function buildWalls(): Matter.Body[] {
  const thick = 20;
  const walls: Matter.Body[] = [
    // left wall
    Bodies.rectangle(-thick / 2, CANVAS_H / 2, thick, CANVAS_H, {
      isStatic: true, label: 'wall', render: { fillStyle: '#7A4A1E' },
    }),
    // right wall
    Bodies.rectangle(CANVAS_W + thick / 2, CANVAS_H / 2, thick, CANVAS_H, {
      isStatic: true, label: 'wall', render: { fillStyle: '#7A4A1E' },
    }),
    // launch-lane separator wall: keeps the launched ball in the right lane on
    // the way up. Its top is below the deflection point so the ball, once
    // turned left by the deflector, clears it into the playfield.
    Bodies.rectangle(
      LANE_WALL_X, (LANE_WALL_Y_TOP + LANE_WALL_Y_BOT) / 2,
      LANE_WALL_THICK, LANE_WALL_Y_BOT - LANE_WALL_Y_TOP,
      { isStatic: true, label: 'wall', render: { fillStyle: '#7A4A1E' } }
    ),
  ];

  // Top-right deflector curve: a circular arc approximated by thin static
  // segments. The ball rises into its concave underside and is smoothly turned
  // left into the playfield.
  const step = (DEFLECTOR_ANGLE_END - DEFLECTOR_ANGLE_START) / DEFLECTOR_SEGMENTS;
  const segLen = 2 * DEFLECTOR_RADIUS * Math.sin(Math.abs(step) / 2) + 8; // overlap neighbours
  for (let i = 0; i < DEFLECTOR_SEGMENTS; i++) {
    const t = DEFLECTOR_ANGLE_START + step * (i + 0.5);
    const cx = DEFLECTOR_CENTER_X + DEFLECTOR_RADIUS * Math.cos(t);
    const cy = DEFLECTOR_CENTER_Y + DEFLECTOR_RADIUS * Math.sin(t);
    walls.push(
      Bodies.rectangle(cx, cy, segLen, 10, {
        isStatic: true,
        angle: t + Math.PI / 2, // tangent to the arc
        friction: 0,
        restitution: DEFLECTOR_RESTITUTION,
        label: 'deflector',
        render: { fillStyle: '#A9743B' },
      })
    );
  }

  return walls;
}

export function createPhysicsWorld(
  onBallSettled: PhysicsWorld['onBallSettled'],
  onBallRemoved: PhysicsWorld['onBallRemoved'],
): PhysicsWorld {
  const engine = Engine.create();
  engine.gravity.y = GRAVITY;
  // Higher iterations stabilise the segmented deflector and nail bounces.
  engine.positionIterations = 12;
  engine.velocityIterations = 10;

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
  const body = Bodies.circle(LAUNCH_START_X, LAUNCH_START_Y, BALL_RADIUS, {
    restitution: BALL_RESTITUTION,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    label: 'ball',
    render: { fillStyle: '#FFFFFF' },
  });

  World.add(world.engine.world, body);

  // Launch straight up the lane; the top-right deflector does the left turn.
  const speed = MIN_LAUNCH_SPEED + power * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED);
  Body.setVelocity(body, { x: 0, y: -speed });

  const ball: PhysicsBall = { body, state: 'flying' };
  world.balls.push(ball);
  return ball;
}

export function stepWorld(world: PhysicsWorld, delta: number): void {
  // Substep to halve per-step travel and avoid tunneling through thin segments.
  const half = delta / 2;
  Engine.update(world.engine, half);
  Engine.update(world.engine, half);

  for (const ball of world.balls) {
    if (ball.state !== 'flying') continue;

    // Remove balls that have left the canvas bottom.
    if (ball.body.position.y > CANVAS_H + BALL_RADIUS * 2) {
      ball.state = 'removed';
      World.remove(world.engine.world, ball.body);
      world.onBallRemoved(ball);
      continue;
    }

    // Anti-stall nudge: if a ball is nearly stationary in the playfield for too
    // long (resting on a nail), give it a small impulse to dislodge it.
    const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y);
    if (speed < 0.6 && ball.body.position.y > 150) {
      ball.lowSpeedSteps = (ball.lowSpeedSteps ?? 0) + 1;
      if (ball.lowSpeedSteps > 30) {
        Body.setVelocity(ball.body, { x: (Math.random() - 0.5) * 5, y: -2.5 });
        ball.lowSpeedSteps = 0;
      }
    } else {
      ball.lowSpeedSteps = 0;
    }
  }
}

export function destroyWorld(world: PhysicsWorld): void {
  World.clear(world.engine.world, false);
  Engine.clear(world.engine);
}
