// Environment & Scaling
export const SCALE = 200; 
export const GRAVITY = -9.81; 

// ITTF Dimensions
export const TABLE_LENGTH = 2.74;
export const TABLE_HEIGHT = 0.76;
export const NET_HEIGHT = 0.1525;
export const BALL_RADIUS = 0.02; 
export const BALL_MASS = 0.0027;
export const GROUND_LENGTH = 5;

// Aerodynamics
export const AIR_DENSITY = 1.225; 
export const DRAG_COEFF = 0.4; 
export const MAGNUS_COEFF = 0.000005;

// Materials
export const RESTITUTION_TABLE = 0.88;
export const FRICTION_TABLE = 0.2;
export const RESTITUTION_RACKET = 0.6;
export const FRICTION_RACKET = 0.85; 
export const RESTITUTION_GROUND = 0.5;
export const FRICTION_GROUND = 0.5;
export const RESTITUTION_NET = 0.2;
export const FRICTION_NET = 0.5;

export const RACKET_LENGTH = 0.15; 

export const TIME_STEP = 1 / 60; 
export const SUB_STEPS = 15; 
export const SUB_DT = TIME_STEP / SUB_STEPS;