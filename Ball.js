import { BALL_RADIUS, BALL_MASS, GRAVITY, AIR_DENSITY, DRAG_COEFF, MAGNUS_COEFF } from './constants.js';

export class Ball {
    constructor(x, y) {
        this.radius = BALL_RADIUS;
        this.mass = BALL_MASS;
        this.reset(x, y);
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.omega = 0; 
        this.angle = 0; // Visual rotation tracking
    }

    update(dt) {
        const area = Math.PI * this.radius * this.radius;
        const vMag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        const dragFactor = -0.5 * AIR_DENSITY * DRAG_COEFF * area * vMag;
        let Fx = dragFactor * this.vx;
        let Fy = dragFactor * this.vy;

        Fx += MAGNUS_COEFF * this.omega * (-this.vy);
        Fy += MAGNUS_COEFF * this.omega * this.vx;
        Fy += this.mass * GRAVITY;

        this.vx += (Fx / this.mass) * dt;
        this.vy += (Fy / this.mass) * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Proper angle tracking for rendering
        this.angle += this.omega * dt;
        this.omega *= (1 - 0.1 * dt); // Slight air resistance on spin
    }
}