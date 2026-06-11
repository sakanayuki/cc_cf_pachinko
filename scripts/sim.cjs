/* Headless trajectory simulation: launches balls at a range of powers and
 * reports where they end up. Used to tune physics constants. */
const { createPhysicsWorld, launchBall, stepWorld } = require('../.sim/physics.js');
const C = require('../.sim/constants.js');

function runOne(power, filled) {
  let outcome = null;
  const world = createPhysicsWorld(
    (r, c) => filled.has(r * 4 + c),
    (_b, r, c) => { outcome = { type: 'settled', r, c }; },
    (_b, refunded) => { outcome = { type: refunded ? 'refund' : 'lost' }; },
    () => {},
  );
  const ball = launchBall(world, power);
  let maxLeft = C.CANVAS_W, minY = C.CANVAS_H;
  let t = 0;
  while (!outcome && t < 30000) {
    stepWorld(world, 1000 / 60);
    t += 1000 / 60;
    maxLeft = Math.min(maxLeft, ball.body.position.x);
    minY = Math.min(minY, ball.body.position.y);
    const p = ball.body.position;
    if (p.x < -30 || p.x > C.CANVAS_W + 30 || p.y < -60) {
      outcome = { type: 'ESCAPED', x: Math.round(p.x), y: Math.round(p.y) };
    }
  }
  if (!outcome) outcome = { type: 'TIMEOUT', x: Math.round(ball.body.position.x), y: Math.round(ball.body.position.y) };
  return { outcome, maxLeft: Math.round(maxLeft), minY: Math.round(minY), ms: Math.round(t) };
}

// --- Sweep powers with empty board ---
console.log('=== power sweep (empty board, 3 runs each) ===');
for (let p = 0; p <= 1.001; p += 0.1) {
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push(runOne(p, new Set()));
  const desc = rows.map(r => {
    const o = r.outcome;
    const what = o.type === 'settled' ? `hole(${o.r},${o.c})` : o.type;
    return `${what} L=${r.maxLeft} topY=${r.minY} ${r.ms}ms`;
  }).join(' | ');
  console.log(`p=${p.toFixed(1)}: ${desc}`);
}

// --- Full-game statistics ---
console.log('\n=== 200 random launches (empty board) ===');
const stats = { settled: 0, lost: 0, refund: 0, other: 0 };
const holeHits = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
let totalMs = 0;
for (let i = 0; i < 200; i++) {
  const { outcome, ms } = runOne(0.15 + Math.random() * 0.85, new Set());
  totalMs += ms;
  if (outcome.type === 'settled') { stats.settled++; holeHits[outcome.r][outcome.c]++; }
  else if (outcome.type === 'lost') stats.lost++;
  else if (outcome.type === 'refund') stats.refund++;
  else { stats.other++; console.log('  anomaly:', outcome); }
}
console.log(stats, 'avg ms/ball:', Math.round(totalMs / 200));
console.log('hole hit distribution:');
for (const row of holeHits) console.log(' ', row.join('\t'));

// --- Simulated full games: how many lines does a 20-ball game score? ---
console.log('\n=== 30 simulated games (20 balls, random power) ===');
const { createBoard, fillCell, countLines } = require('../.sim/board.js');
const lineCounts = [];
for (let g = 0; g < 30; g++) {
  let board = createBoard();
  const filled = new Set();
  let balls = 20;
  while (balls > 0) {
    balls--;
    const { outcome } = runOne(0.15 + Math.random() * 0.85, filled);
    if (outcome.type === 'settled') {
      filled.add(outcome.r * 4 + outcome.c);
      board = fillCell(board, outcome.r, outcome.c);
    } else if (outcome.type === 'refund') {
      balls++; // returned ball — but avoid infinite loop in sim
      if (Math.random() < 0.05) balls--;
    }
  }
  lineCounts.push(countLines(board));
}
lineCounts.sort((a, b) => a - b);
const avg = lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length;
console.log('lines per game:', lineCounts.join(','), '| avg:', avg.toFixed(2));
