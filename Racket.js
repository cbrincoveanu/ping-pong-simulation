import { RACKET_LENGTH } from './constants.js';

export class Racket {
    constructor() {
        this.length = RACKET_LENGTH;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.angle = Math.PI / 4; 
    }

    update(dt, targetX, targetY) {
        // Spring-Damper physics so the racket doesn't teleport
        const spring = 1500;
        const damp = 60;
        
        const ax = (targetX - this.x) * spring - this.vx * damp;
        const ay = (targetY - this.y) * spring - this.vy * damp;
        
        this.vx += ax * dt;
        this.vy += ay * dt;
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    rotate(delta) {
        this.angle += delta;
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