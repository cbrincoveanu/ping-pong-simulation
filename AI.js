import { TABLE_LENGTH } from './constants.js';

export class AI {
    constructor(side) {
        this.side = side;
        this.dir = side === 'left' ? 1 : -1; 
        this.baseX = side === 'left' ? -(TABLE_LENGTH / 2) - 0.05 : (TABLE_LENGTH / 2) + 0.05;
        
        this.targetX = this.baseX;
        this.targetY = 0.2;
        this.targetAngle = Math.PI * 0.5;
        this.nextRandom = 0;
    }

    update(dt, ball, umpire, onTossCommand, racket) {
        const rx = racket.x;
        const ry = racket.y;

        // --- 1. SERVING LOGIC (Kept exactly as you tuned it) ---
        if (umpire.state === 'PRE_SERVE' && umpire.server === this.side) {
            this.targetX = this.baseX;
            this.targetY = 0.45;
            this.targetAngle = this.side === 'left' ? Math.PI * 0.75 : Math.PI * 0.25; 
            
            if (Math.random() < 0.05 && Math.abs(rx - this.targetX) < 0.05 && Math.abs(ry - this.targetY) < 0.05) {
                onTossCommand(this.targetX);
            }
            return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
        }

        if (umpire.state === 'TOSS' && umpire.server === this.side) {
            if (ball.vy < 0 && Math.abs(ball.y - ry) < 0.3) {
                this.targetX = this.baseX;
                this.targetY = 0.45;
            }
            return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
        }

        // --- 2. DYNAMIC RALLY LOGIC ---
        const isIncoming = (this.side === 'left' && ball.vx < 0) || (this.side === 'right' && ball.vx > 0);
        const isOnMySide = (this.side === 'left' && ball.x < 0) || (this.side === 'right' && ball.x > 0);

        // Default neutral face
        this.targetAngle = Math.PI * 0.5; 

        if (isIncoming && isOnMySide) {
            // TRACKING X: Calculate ideal position
            let idealX = ball.x - (this.dir * 0.3); 
            
            if (this.side === 'left') {
                idealX = Math.max(this.baseX - 0.5, Math.min(-0.2, idealX));
            } else {
                idealX = Math.min(this.baseX + 0.5, Math.max(0.2, idealX));
            }

            // SMOOTH TRACKING: Glide towards the X position instead of instantly teleporting
            this.targetX += (idealX - this.targetX) * 8 * dt;

            // WAIT FOR BOUNCE LOGIC
            const hasBounced = umpire.validBounces > 0;

            if (!hasBounced) {
                // Ball is in the air: Keep racket low and wait
                this.targetX = this.baseX - (this.dir * 0.25);
                this.targetY += (0.1 - this.targetY) * 8 * dt;
            } else {
                // Ball has bounced! Now track its Y height to prepare for contact
                let idealY = Math.max(0.0, ball.y - 0.1); 
                this.targetY += (idealY - this.targetY) * 15 * dt;

                // SWING LOGIC
                const distToBallX = Math.abs(ball.x - rx);
                const isInFront = this.side === 'left' ? ball.x > rx : ball.x < rx;
                
                // Swing only when it's in front and close
                if (isInFront && distToBallX < 0.4) {
                    this.targetX = rx + (this.dir * (0.09+this.nextRandom*0.04)) //+ (this.dir * 0.6); // Fast forward brush
                    this.targetY = ry + 0.1 + (this.nextRandom * 0.07); // + 0.2; // Brushing upward for topspin
                    
                    this.targetAngle = this.side === 'left' ? Math.PI * (0.5-this.nextRandom*0.05) : Math.PI * (0.5+this.nextRandom*0.05); 
                }
            }
        } else {
            // Ball moving away: Smoothly reset to ready position
            this.targetX += (this.baseX - this.targetX) * 5 * dt;
            this.targetY += (0.2 - this.targetY) * 5 * dt;
            this.nextRandom = Math.random(); // New random value for next swing variation
        }

        return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
    }
}