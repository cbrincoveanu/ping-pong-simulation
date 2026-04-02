import { RACKET_LENGTH } from './constants.js';

export class Racket {
    constructor(color, initialAngle) {
        this.length = RACKET_LENGTH;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.angle = initialAngle; 
        this.color = color;
    }

    update(dt, targetX, targetY) {
        const spring = 1500; // 400
        const damp = 60; // 40
        
        const ax = (targetX - this.x) * spring - this.vx * damp;
        const ay = (targetY - this.y) * spring - this.vy * damp;
        
        this.vx += ax * dt;
        this.vy += ay * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    // Used by Human (Mouse Wheel)
    rotate(delta) {
        this.angle += delta;
    }

    // Used by AI (Smooth interpolation to target angle)
    setAngle(targetAngle, dt) {
        //this.angle += (targetAngle - this.angle) * 15 * dt;
        this.angle = targetAngle; // Instant angle change for AI (more responsive)
    }

    getSegment() {
        const dx = Math.cos(this.angle) * (this.length / 2);
        const dy = Math.sin(this.angle) * (this.length / 2);
        return {
            a: { x: this.x - dx, y: this.y - dy },
            b: { x: this.x + dx, y: this.y + dy }
        };
    }
}