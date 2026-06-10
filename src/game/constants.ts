export const TOTAL_BALLS = 20;
export const GRID_SIZE = 4;

// Canvas logical size (portrait)
export const CANVAS_W = 390;
export const CANVAS_H = 600;

// Board layout (4x4 holes). Uniform square grid – all rows aligned.
export const HOLE_RADIUS = 22;
export const HOLE_GRID_ORIGIN_X = CANVAS_W / 2 - (GRID_SIZE * 70) / 2 + 35; // center of first col
export const HOLE_GRID_ORIGIN_Y = 210;
export const HOLE_SPACING = 70;        // column spacing (x)
export const HOLE_ROW_SPACING = 72;    // row spacing (y)
export const HOLE_STAGGER_X = 0;       // no stagger – uniform square grid

// Nails
export const NAIL_RADIUS = 5;

// Ball
export const BALL_RADIUS = 14;

// Launcher
export const LAUNCHER_X = CANVAS_W - 40;
export const LAUNCHER_Y = CANVAS_H - 50; // approx launch point within canvas
export const MAX_PULL = 80; // pixels of swipe = full power
// Launch speed is in px/step (Matter velocity units). Tuned (with engine
// substepping) so even the weakest launch reaches the top deflector curve.
export const MIN_LAUNCH_SPEED = 34;
export const MAX_LAUNCH_SPEED = 44;
export const LAUNCH_START_X = 368; // inside the right launch lane
export const LAUNCH_START_Y = CANVAS_H - 80;

// Top-right corner deflector: a short circular arc positioned at the very top-right
// of the canvas. The ball rises up the launch lane, hits this arc, and is deflected
// left-downward into the playfield from the upper-right.
export const DEFLECTOR_CENTER_X = 390;
export const DEFLECTOR_CENTER_Y = 30;
export const DEFLECTOR_RADIUS = 50;
export const DEFLECTOR_SEGMENTS = 8;
export const DEFLECTOR_ANGLE_START = 90 * Math.PI / 180;  // bottom of arc (390, 80)
export const DEFLECTOR_ANGLE_END = 146 * Math.PI / 180;   // left end of arc (~349, 58)
export const DEFLECTOR_RESTITUTION = 0.45;

// Launch-lane separator wall (right side). Its top sits BELOW the deflection
// point so a deflected ball clears it into the field.
export const LANE_WALL_X = 345;
export const LANE_WALL_THICK = 12;
export const LANE_WALL_Y_TOP = 120;
export const LANE_WALL_Y_BOT = 560;

// Physics
export const GRAVITY = 1.0;
export const BALL_RESTITUTION = 0.45;
export const NAIL_RESTITUTION = 0.5;
export const BALL_FRICTION = 0.01;
export const BALL_FRICTION_AIR = 0.006;
