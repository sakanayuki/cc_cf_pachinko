export const TOTAL_BALLS = 20;
export const GRID_SIZE = 4;

// Canvas logical size (portrait)
export const CANVAS_W = 390;
export const CANVAS_H = 640;

// Visible chrome frame around the board; physics walls sit on its inner edge
export const FRAME_W = 8;

// Launch chute on the right edge of the board
export const CHUTE_W = 36;
export const CHUTE_INNER_X = CANVAS_W - CHUTE_W; // inner wall x = 354
export const CHUTE_WALL_TOP = 165; // inner wall ends here so the ball can exit
export const PLAY_W = CHUTE_INNER_X; // playfield width

// Top arch (outer guide rail). Circle centered below the apex.
export const ARCH_CX = CANVAS_W / 2;
export const ARCH_CY = 255;
export const ARCH_R = 225; // apex at y = ARCH_CY - ARCH_R = 30

// Board layout (4x4 holes centered in the playfield)
export const HOLE_RADIUS = 14;
export const HOLE_SPACING = 66;
export const HOLE_GRID_ORIGIN_X = PLAY_W / 2 - (GRID_SIZE - 1) * HOLE_SPACING / 2; // 78
export const HOLE_GRID_ORIGIN_Y = 268;

// Capture: ball settles when its center comes this close to a hole center
export const HOLE_CAPTURE_DIST = 10;
// Mild attraction toward an empty hole within this distance (feels like a dip)
export const HOLE_ATTRACT_DIST = 24;
export const HOLE_ATTRACT_FORCE = 0.0005;

// Nails
export const NAIL_RADIUS = 3.5;

// Ball
export const BALL_RADIUS = 10;

// Launcher input
export const MAX_PULL = 110; // pixels of swipe = full power

// Physics tuning (board behaves like a gently inclined table)
export const GRAVITY = 0.55;
export const BALL_RESTITUTION = 0.35;
export const NAIL_RESTITUTION = 0.55;
export const WALL_RESTITUTION = 0.3;
export const BALL_FRICTION = 0.005;
export const BALL_FRICTION_AIR = 0.012;
export const MIN_LAUNCH_SPEED = 16.6;
export const MAX_LAUNCH_SPEED = 21;
export const LAUNCH_JITTER = 0.18; // tiny speed randomness so equal pulls differ

// Anti-stall: nudge slow balls, recycle hopeless ones
export const STALL_SPEED = 0.45;
export const STALL_NUDGE_MS = 900;
export const STALL_REMOVE_MS = 6000;
