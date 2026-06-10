export const TOTAL_BALLS = 20;
export const GRID_SIZE = 4;

// Canvas logical size (portrait)
export const CANVAS_W = 390;
export const CANVAS_H = 600;

// Board layout (4x4 holes). Uniform square grid – all rows aligned.
export const HOLE_RADIUS = 22;
export const HOLE_GRID_ORIGIN_X = 75; // first column center; shifted left to keep rightmost hole clear of lane
export const HOLE_GRID_ORIGIN_Y = 240; // moved down to give gap from bottom nail row
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
export const MIN_LAUNCH_SPEED = 36;
export const MAX_LAUNCH_SPEED = 48;
export const LAUNCH_START_X = 368; // inside the right launch lane
export const LAUNCH_START_Y = CANVAS_H - 80;

// Top-right corner deflector: concave arc – center is inside the canvas (lower-left of arc),
// so the arc's hollow/bowl side faces the playfield. Ball rises up the lane, passes through
// the circle's lower crossing, and hits the concave upper arc, deflecting left.
export const DEFLECTOR_CENTER_X = 310;
export const DEFLECTOR_CENTER_Y = 130;
export const DEFLECTOR_RADIUS = 110;
export const DEFLECTOR_SEGMENTS = 8;
export const DEFLECTOR_ANGLE_START = -70 * Math.PI / 180; // left end  ≈ (348, 27)
export const DEFLECTOR_ANGLE_END   = -45 * Math.PI / 180; // right end ≈ (388, 52)
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
