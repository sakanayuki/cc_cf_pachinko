export const TOTAL_BALLS = 20;
export const GRID_SIZE = 4;

// Canvas logical size (portrait)
export const CANVAS_W = 390;
export const CANVAS_H = 600;

// Board layout (4x4 holes in the center of the canvas)
export const HOLE_RADIUS = 18;
export const HOLE_GRID_ORIGIN_X = CANVAS_W / 2 - (GRID_SIZE * 70) / 2 + 35; // center of first col
export const HOLE_GRID_ORIGIN_Y = 200;
export const HOLE_SPACING = 70;

// Nails
export const NAIL_RADIUS = 5;

// Ball
export const BALL_RADIUS = 14;

// Launcher
export const LAUNCHER_X = CANVAS_W - 40;
export const LAUNCHER_Y = CANVAS_H - 50; // approx launch point within canvas
export const MAX_PULL = 80; // pixels of swipe = full power
export const MIN_LAUNCH_SPEED = 8;
export const MAX_LAUNCH_SPEED = 22;

// Physics
export const GRAVITY = 1.2;
export const BALL_RESTITUTION = 0.45;
export const NAIL_RESTITUTION = 0.5;
export const BALL_FRICTION = 0.01;
export const BALL_FRICTION_AIR = 0.008;
