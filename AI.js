import { TABLE_LENGTH, TIME_STEP, SUB_DT, SUB_STEPS, RESTITUTION_RACKET, FRICTION_RACKET } from './constants.js';
import { Ball } from './Ball.js';
import { resolveCollision } from './physics.js';

export class AI {
    constructor(side) {
        this.side = side;
        this.dir = side === 'left' ? 1 : -1; 
        this.baseX = side === 'left' ? -(TABLE_LENGTH / 2) - 0.1 : (TABLE_LENGTH / 2) + 0.1;
        
        this.targetX = this.baseX;
        this.targetY = 0.2;
        this.targetAngle = Math.PI * 0.5;
        
        this.state = 'IDLE'; 
        this.plan = null;
        this.plannedSwing = null;
        this.timeToImpact = 0; 
        
        this.hasRecalculated = false; 
        this.hasHit = false; 
        
        // NEW: Track the ball after hitting to see where it actually lands
        this.monitoringFlight = false; 
        this.prevBallY = 0; 
    }

    predictStrikePoint(realBall, umpire) {
        let simBall = new Ball(realBall.x, realBall.y);
        simBall.vx = realBall.vx; simBall.vy = realBall.vy; simBall.omega = realBall.omega;

        let simHasBounced = (umpire.state === 'RALLY' && umpire.validBounces > 0 && umpire.lastHitter !== this.side);
        let simTime = 0; 
        
        for (let i = 0; i < 120; i++) { 
            let prevY = simBall.y;
            for(let s = 0; s < SUB_STEPS; s++) simBall.update(SUB_DT);
            simTime += TIME_STEP; 

            if (!simHasBounced && simBall.y < 0 && prevY >= 0 && Math.abs(simBall.x) < TABLE_LENGTH / 2) {
                simBall.y = 0;
                simBall.vy = -simBall.vy * 0.85; 
                
                const isMySide = (this.side === 'left' && simBall.x < 0) || (this.side === 'right' && simBall.x > 0);
                if (isMySide) {
                    simHasBounced = true;
                }
            }

            if (simHasBounced && simBall.vy < 0 && simBall.y < 1) {
                return { 
                    x: simBall.x, y: simBall.y, 
                    time: simTime, 
                    found: true,
                    ballState: { x: simBall.x, y: simBall.y, vx: simBall.vx, vy: simBall.vy, omega: simBall.omega }
                };
            }
        }
        return { found: false };
    }

    calculateOptimalSwing(strikeBallState) {
        // Aim for the deep middle of the opponent's table
        let desiredLandingX = this.dir === 1 ? (TABLE_LENGTH / 2) * 0.75 : -(TABLE_LENGTH / 2) * 0.75;
        let bestDiff = Infinity;
        let bestSwing = null;

        let angles = this.side === 'left' ? 
            [Math.PI * 0.25, Math.PI * 0.4, Math.PI * 0.5, Math.PI * 0.6, Math.PI * 0.75, Math.PI * Math.random()] :
            [Math.PI * 0.25, Math.PI * 0.4, Math.PI * 0.5, Math.PI * 0.6, Math.PI * 0.75, Math.PI * Math.random()];

        // FIX: Give the AI access to much higher smash speeds so it can reach the target from far away!
        let xspeeds = [0, 2, 4, 6, 8, 10, Math.random() * 12]; 
        let yspeeds = [-6, -2, 0, 2, 4, 8, Math.random() * 12];

        for (let a of angles) {
            for (let vx of xspeeds) {
                for (let vy of yspeeds) {
                    let testBall = new Ball(strikeBallState.x, strikeBallState.y);
                    testBall.vx = strikeBallState.vx; testBall.vy = strikeBallState.vy; testBall.omega = strikeBallState.omega;

                    let rvx = this.dir * vx;
                    let rvy = vy; 

                    let nx = -Math.sin(a); let ny = Math.cos(a);
                    if (this.side === 'left' && nx < 0) { nx = -nx; ny = -ny; }
                    if (this.side === 'right' && nx > 0) { nx = -nx; ny = -ny; }

                    resolveCollision(testBall, {vx: rvx, vy: rvy}, {x: nx, y: ny}, RESTITUTION_RACKET, FRICTION_RACKET);

                    let hasCrossedNet = false;
                    let hitNet = false;
                    
                    // Simulate up to 2.0 seconds of flight
                    for (let i = 0; i < 120; i++) {
                        for(let s=0; s<SUB_STEPS; s++) testBall.update(SUB_DT);
                        
                        let isPastNet = (this.side === 'left' && testBall.x > 0) || (this.side === 'right' && testBall.x < 0);
                        
                        // FIX: Strict Net Collision Logic
                        if (isPastNet && !hasCrossedNet) {
                            hasCrossedNet = true;
                            // If it is below 0.155m exactly when it crosses the 0 X-axis, it hit the net!
                            if (testBall.y < 0.155) {
                                hitNet = true;
                                break; 
                            }
                        }

                        // Did it legally land on the table?
                        if (testBall.y < 0 && hasCrossedNet && !hitNet) {
                            let diff = Math.abs(testBall.x - desiredLandingX);
                            if (diff < bestDiff) {
                                bestDiff = diff; 
                                bestSwing = { vx: rvx, vy: rvy, angle: a, bestDiff: diff, expectedLandingX: testBall.x };
                            }
                            break;
                        }
                    }
                }
            }
        }
        
        if (!bestSwing) {
            console.log(`[AI ${this.side}] WARNING: Solver Failed! Using fallback.`);
            //bestSwing = { vx: this.dir * 4, vy: 2.0, angle: Math.PI * 0.5, expectedLandingX: desiredLandingX };
            bestSwing = { vx: 0, vy: 0, angle: this.side === 'left' ? Math.PI * 0.75 : Math.PI * 0.25, expectedLandingX: desiredLandingX };
        }
        return bestSwing;
    }

    update(dt, ball, umpire, onTossCommand, racket) {
        const rx = racket.x; const ry = racket.y;

        // --- NEW: ABORT EVERYTHING IF THE POINT IS OVER ---
        if (!umpire.pointActive) {
            this.state = 'IDLE';
            this.plan = null;
            this.hasRecalculated = false;
            this.hasHit = false;
            this.monitoringFlight = false;
            
            // Gently return to base while waiting for the next point
            this.targetX += (this.baseX - this.targetX) * 5 * dt;
            this.targetY += (0.2 - this.targetY) * 5 * dt;
            this.targetAngle += ((Math.PI * 0.5) - this.targetAngle) * 5 * dt;
            return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
        }
        // --------------------------------------------------

        // --- FLIGHT MONITORING ---
        if (this.monitoringFlight) {
            if (ball.y <= 0 && this.prevBallY > 0 && Math.abs(ball.x) < TABLE_LENGTH / 2) {
                const landingDiff = Math.abs(ball.x - this.plannedSwing.expectedLandingX);
                console.log(`[AI ${this.side}] >> ACTUAL LANDING X: ${ball.x.toFixed(3)} | Expected: ${this.plannedSwing.expectedLandingX.toFixed(3)} | Diff: ${landingDiff.toFixed(3)}m`);
                console.log(`-------------------------------------------------`);
                this.monitoringFlight = false;
            } 
            else if (ball.y < -0.1 || Math.abs(ball.x) > (TABLE_LENGTH / 2) + 0.5) {
                console.log(`[AI ${this.side}] >> ACTUAL LANDING: FAILED (Ball died at X: ${ball.x.toFixed(3)}, Y: ${ball.y.toFixed(3)})`);
                console.log(`-------------------------------------------------`);
                this.monitoringFlight = false;
            }
        }
        this.prevBallY = ball.y;

        // --- ACTUAL HIT LOGGING ---
        if (!this.hasHit && umpire.lastHitter === this.side && umpire.state === 'RALLY' && this.plan) {
            this.hasHit = true;
            this.monitoringFlight = true; 
            
            console.log(`[AI ${this.side}] == ACTUAL HIT ==`);
            console.log(`   Pos: (${rx.toFixed(3)}, ${ry.toFixed(3)}) | Expected: (${this.plan.x.toFixed(3)}, ${this.plan.y.toFixed(3)})`);
            console.log(`   Vel: (${racket.vx.toFixed(2)}, ${racket.vy.toFixed(2)}) | Expected: (${this.plannedSwing.vx.toFixed(2)}, ${this.plannedSwing.vy.toFixed(2)})`);
            console.log(`   Timing Error: ${this.timeToImpact.toFixed(3)}s`);
        }

        // --- 1. SERVING ---
        if (umpire.state === 'PRE_SERVE' && umpire.server === this.side) {
            this.targetX = this.baseX; this.targetY = 0.45;
            this.targetAngle = this.side === 'left' ? Math.PI * 0.75 : Math.PI * 0.25; 
            if (Math.random() < 0.05 && Math.abs(rx - this.targetX) < 0.05) onTossCommand(this.targetX);
            return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
        }
        if (umpire.state === 'TOSS' && umpire.server === this.side) {
            if (ball.vy < 0 && Math.abs(ball.y - ry) < 0.3) { this.targetX = this.baseX; this.targetY = 0.45; }
            return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
        }

        // --- 2. PREDICTION TRIGGER ---
        const isIncoming = (this.side === 'left' && ball.vx < 0) || (this.side === 'right' && ball.vx > 0);

        if (isIncoming) {
            if (this.state === 'IDLE') {
                let prediction = this.predictStrikePoint(ball, umpire);
                if (prediction.found) {
                    this.plan = prediction;
                    this.plannedSwing = this.calculateOptimalSwing(prediction.ballState);
                    this.timeToImpact = prediction.time;
                    this.state = 'TRACKING';
                    this.hasRecalculated = false; 
                    this.hasHit = false; 
                    this.monitoringFlight = false; 
                    
                    console.log(`\n[AI ${this.side}] -- NEW PLAN CREATED --`);
                    console.log(`   Target Pos: (${this.plan.x.toFixed(3)}, ${this.plan.y.toFixed(3)}) in ${this.timeToImpact.toFixed(3)}s`);
                    console.log(`   Target Vel: (${this.plannedSwing.vx.toFixed(2)}, ${this.plannedSwing.vy.toFixed(2)}) | Angle: ${(this.plannedSwing.angle * 180 / Math.PI).toFixed(0)}°`);
                }
            }
        } else {
            this.state = 'IDLE';
            this.plan = null;
            this.hasRecalculated = false;
        }

        // --- 3. TIME-BASED EXECUTION & RECALCULATION ---
        if ((this.state === 'TRACKING' || this.state === 'SWINGING') && this.plan) {
            
            if (this.hasHit) {
                this.state = 'IDLE';
                this.plan = null;
                return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
            }

            const hasBounced = (umpire.state === 'RALLY' && umpire.validBounces > 0 && umpire.lastHitter !== this.side);
            
            if (hasBounced && !this.hasRecalculated && this.state === 'TRACKING') {
                let newPrediction = this.predictStrikePoint(ball, umpire);
                if (newPrediction.found) {
                    this.plan = newPrediction;
                    this.plannedSwing = this.calculateOptimalSwing(newPrediction.ballState);
                    this.timeToImpact = newPrediction.time; 
                    
                    console.log(`[AI ${this.side}] -- RECALCULATED PLAN (Post-Bounce) --`);
                    console.log(`   Target Pos: (${this.plan.x.toFixed(3)}, ${this.plan.y.toFixed(3)}) in ${this.timeToImpact.toFixed(3)}s`);
                    console.log(`   Target Vel: (${this.plannedSwing.vx.toFixed(2)}, ${this.plannedSwing.vy.toFixed(2)}) | Angle: ${(this.plannedSwing.angle * 180 / Math.PI).toFixed(0)}°`);
                }
                this.hasRecalculated = true; 
            }

            this.timeToImpact -= dt; 

            let swingLeadTime = 0.15; 

            if (this.timeToImpact > swingLeadTime) {
                this.state = 'TRACKING';
                let startX = this.plan.x - (this.plannedSwing.vx * swingLeadTime);
                let startY = 0.05; 
                
                this.targetX += (startX - this.targetX) * 25 * dt;
                this.targetY += (startY - this.targetY) * 25 * dt;
                this.targetAngle += (this.plannedSwing.angle - this.targetAngle) * 25 * dt;
            } 
            else if (this.timeToImpact > -0.1) {
                this.state = 'SWINGING';
                
                let idealX = this.plan.x - (this.plannedSwing.vx * this.timeToImpact);
                let idealY = this.plan.y - (this.plannedSwing.vy * this.timeToImpact);

                let pdLagOffset = 0.04; 
                
                this.targetX = idealX + (this.plannedSwing.vx * pdLagOffset);
                this.targetY = idealY + (this.plannedSwing.vy * pdLagOffset);
                this.targetAngle = this.plannedSwing.angle;
            } 
            else {
                this.state = 'IDLE';
                this.plan = null;
            }
        } 
        else if (this.state === 'IDLE') {
            this.targetX += (this.baseX - this.targetX) * 5 * dt;
            this.targetY += (0.2 - this.targetY) * 5 * dt;
            this.targetAngle += ((Math.PI * 0.5) - this.targetAngle) * 5 * dt;
        }

        return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
    }
}