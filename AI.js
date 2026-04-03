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
        this.monitoringFlight = false; 
        this.prevBallY = 0; 
    }

    predictStrikePoint(realBall, umpire) {
        let simBall = new Ball(realBall.x, realBall.y);
        simBall.vx = realBall.vx; simBall.vy = realBall.vy; simBall.omega = realBall.omega;

        // Serve logic: If we are in TOSS, we don't wait for a bounce, we are creating one
        let simHasBounced = (umpire.state === 'RALLY' && umpire.validBounces > 0 && umpire.lastHitter !== this.side);
        
        let simTime = 0; 
        for (let i = 0; i < 120; i++) { 
            let prevY = simBall.y;
            for(let s = 0; s < SUB_STEPS; s++) simBall.update(SUB_DT);
            simTime += TIME_STEP; 

            if (umpire.state !== 'TOSS' && !simHasBounced && simBall.y < 0 && prevY >= 0 && Math.abs(simBall.x) < TABLE_LENGTH / 2) {
                simBall.y = 0;
                simBall.vy = -simBall.vy * 0.85; 
                if ((this.side === 'left' && simBall.x < 0) || (this.side === 'right' && simBall.x > 0)) simHasBounced = true;
            }

            // Target strike zone (For Serve TOSS, we hit it as it falls back to 0.45m)
            const targetY = (umpire.state === 'TOSS') ? 0.45 : 0.18;
            const readyToHit = (umpire.state === 'TOSS') ? (simBall.vy < 0) : simHasBounced;

            if (readyToHit && simBall.vy < 0 && simBall.y < targetY) {
                return { 
                    x: simBall.x, y: simBall.y, time: simTime, found: true,
                    ballState: { x: simBall.x, y: simBall.y, vx: simBall.vx, vy: simBall.vy, omega: simBall.omega }
                };
            }
        }
        return { found: false };
    }

    // Specialized solver for Serves
    calculateOptimalServe(strikeBallState) {
        let desiredLandingX = this.dir === 1 ? (TABLE_LENGTH / 2) * (0.3 + Math.random() * 0.5) : -(TABLE_LENGTH / 2) * (0.3 + Math.random() * 0.5);
        let bestDiff = Infinity;
        let bestSwing = null;

        // Serves need a more "downward" or "neutral" angle to hit own side first
        let angles = this.side === 'left' ? [Math.PI * 0.5, Math.PI * 0.6, Math.PI * 0.7, Math.PI * 0.8, Math.PI * 0.9, Math.PI * Math.random()] : [Math.PI * 0.5, Math.PI * 0.4, Math.PI * 0.3, Math.PI * 0.2, Math.PI * 0.1, Math.PI * Math.random()];
        let speedsx = [0, 1, 2, 3, 4, 5, 6 * Math.random()];
        let speedsy = [-2, -1, 0, 1, 2, 3 - (6 * Math.random())];

        for (let a of angles) {
            for (let vx of speedsx) {
                for (let vy of speedsy) {
                    let testBall = new Ball(strikeBallState.x, strikeBallState.y);
                    testBall.vx = strikeBallState.vx; testBall.vy = strikeBallState.vy; testBall.omega = strikeBallState.omega;
                    let rvx = this.dir * vx;
                    let rvy = vy;

                    let nx = -Math.sin(a); let ny = Math.cos(a);
                    if (this.side === 'left' && nx < 0) { nx = -nx; ny = -ny; }
                    if (this.side === 'right' && nx > 0) { nx = -nx; ny = -ny; }

                    resolveCollision(testBall, {vx: rvx, vy: rvy}, {x: nx, y: ny}, RESTITUTION_RACKET, FRICTION_RACKET);

                    let bouncedOwn = false;
                    let clearedNet = false;

                    for (let i = 0; i < 150; i++) {
                        let pY = testBall.y;
                        for(let s=0; s<SUB_STEPS; s++) testBall.update(SUB_DT);
                        
                        // Bounce on own side
                        if (!bouncedOwn && testBall.y < 0 && pY >= 0) {
                            const onOwnSide = (this.side === 'left' && testBall.x < 0) || (this.side === 'right' && testBall.x > 0);
                            if (onOwnSide && Math.abs(testBall.x) < TABLE_LENGTH/2) {
                                bouncedOwn = true;
                                testBall.y = 0; testBall.vy = -testBall.vy * 0.85;
                            } else break;
                        }
                        // Clear net
                        if (bouncedOwn && !clearedNet && ((this.side === 'left' && testBall.x > 0) || (this.side === 'right' && testBall.x < 0))) {
                            if (testBall.y > 0.155) clearedNet = true;
                            else break;
                        }
                        // Land on opponent side
                        if (clearedNet && testBall.y < 0) {
                            let diff = Math.abs(testBall.x - desiredLandingX);
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                bestSwing = { vx: rvx, vy: rvy, angle: a, expectedLandingX: testBall.x };
                            }
                            break;
                        }
                    }
                }
            }
        }
        return bestSwing;
    }

    calculateOptimalSwing(strikeBallState) {
        let desiredLandingX = this.dir === 1 ? (TABLE_LENGTH / 2) * (0.2 + Math.random() * 0.7) : -(TABLE_LENGTH / 2) * (0.2 + Math.random() * 0.7);
        let bestDiff = Infinity;
        let bestSwing = null;

        let angles = [Math.PI * 0.25, Math.PI * 0.4, Math.PI * 0.5, Math.PI * 0.6, Math.PI * 0.75, Math.PI * Math.random()];
        let xspeeds = [0, 2, 4, 6, 8, 10, 12, Math.random() * 12]; 
        let yspeeds = [-2, 0, 2, 4, 6, 12 - (Math.random() * 14)];

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
                    for (let i = 0; i < 120; i++) {
                        for(let s=0; s<SUB_STEPS; s++) testBall.update(SUB_DT);
                        let isPastNet = (this.side === 'left' && testBall.x > 0) || (this.side === 'right' && testBall.x < 0);
                        if (isPastNet && !hasCrossedNet) {
                            hasCrossedNet = true;
                            if (testBall.y < 0.155) break; 
                        }
                        if (testBall.y < 0 && hasCrossedNet) {
                            let diff = Math.abs(testBall.x - desiredLandingX);
                            if (diff < bestDiff) {
                                bestDiff = diff; 
                                bestSwing = { vx: rvx, vy: rvy, angle: a, expectedLandingX: testBall.x };
                            }
                            break;
                        }
                    }
                }
            }
        }
        return bestSwing || { vx: this.dir * 4, vy: 1.5, angle: Math.PI * 0.5, expectedLandingX: desiredLandingX };
    }

    update(dt, ball, umpire, onTossCommand, racket) {
        const rx = racket.x; const ry = racket.y;

        // --- 1. ABORT EVERYTHING IF THE POINT IS OVER ---
        if (!umpire.pointActive) {
            this.state = 'IDLE';
            this.plan = null;
            this.hasRecalculated = false;
            this.hasHit = false;
            this.monitoringFlight = false;
            
            this.targetX += (this.baseX - this.targetX) * 5 * dt;
            this.targetY += (0.2 - this.targetY) * 5 * dt;
            this.targetAngle += ((Math.PI * 0.5) - this.targetAngle) * 5 * dt;
            return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
        }

        // --- 2. FLIGHT MONITORING (Check where the ball actually lands) ---
        if (this.monitoringFlight && this.plannedSwing && umpire.lastHitter === this.side) {
            if (ball.y <= 0 && this.prevBallY > 0 && Math.abs(ball.x) < TABLE_LENGTH / 2) {
                const landingDiff = Math.abs(ball.x - this.plannedSwing.expectedLandingX);
                console.log(`[AI ${this.side}] >> ACTUAL LANDING X: ${ball.x.toFixed(3)} | Expected: ${this.plannedSwing.expectedLandingX.toFixed(3)} | Diff: ${landingDiff.toFixed(3)}m`);
                this.monitoringFlight = false;
            } 
            // FIX: Increased boundary to 5 meters so deep-baseline play doesn't trigger a "Failure" log
            else if (ball.y < -0.5 || Math.abs(ball.x) > 5.0) {
                console.log(`[AI ${this.side}] >> ACTUAL LANDING: FAILED (Ball out of play)`);
                this.monitoringFlight = false;
            }
        }
        this.prevBallY = ball.y;

        // --- 3. ACTUAL HIT LOGGING ---
        // Triggers the exact frame the Umpire registers a hit from this AI
        if (!this.hasHit && umpire.lastHitter === this.side) {
            this.hasHit = true;
            this.monitoringFlight = true; // Start monitoring the flight of the ball we just hit
            
            // Only log detailed "Expected vs Actual" if we have a kinematic plan (Rally or Dynamic Serve)
            if (this.plan && this.plannedSwing) {
                console.log(`[AI ${this.side}] == ACTUAL HIT (${umpire.state}) ==`);
                console.log(`   Pos: (${rx.toFixed(3)}, ${ry.toFixed(3)}) | Plan: (${this.plan.x.toFixed(3)}, ${this.plan.y.toFixed(3)})`);
                console.log(`   Vel: (${racket.vx.toFixed(2)}, ${racket.vy.toFixed(2)}) | Plan: (${this.plannedSwing.vx.toFixed(2)}, ${this.plannedSwing.vy.toFixed(2)})`);
                console.log(`   Timing Error: ${this.timeToImpact.toFixed(3)}s`);
            } else {
                console.log(`[AI ${this.side}] == ACTUAL HIT == (No Kinematic Plan)`);
            }
        }

        // --- 1. DYNAMIC SERVING ---
        if (umpire.state === 'PRE_SERVE' && umpire.server === this.side) {
            this.targetX = this.baseX; this.targetY = 0.45;
            this.targetAngle = this.side === 'left' ? Math.PI * 0.75 : Math.PI * 0.25; 
            if (Math.random() < 0.02 && Math.abs(rx - this.targetX) < 0.05) onTossCommand(this.targetX);
            return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
        }

        // If ball is tossed, plan the serve hit
        if (umpire.state === 'TOSS' && umpire.server === this.side && this.state === 'IDLE') {
            let prediction = this.predictStrikePoint(ball, umpire);
            if (prediction.found) {
                this.plan = prediction;
                this.plannedSwing = this.calculateOptimalServe(prediction.ballState);
                this.timeToImpact = prediction.time;
                this.state = 'TRACKING';
                this.hasHit = false;
                console.log(`[AI ${this.side}] Dynamic Serve Planned!`);
            }
        }

        // --- 2. RALLY PREDICTION ---
        const isIncoming = (this.side === 'left' && ball.vx < 0) || (this.side === 'right' && ball.vx > 0);
        if (isIncoming && this.state === 'IDLE' && umpire.state === 'RALLY') {
            let prediction = this.predictStrikePoint(ball, umpire);
            if (prediction.found) {
                this.plan = prediction;
                this.plannedSwing = this.calculateOptimalSwing(prediction.ballState);
                this.timeToImpact = prediction.time;
                this.state = 'TRACKING';
                this.hasRecalculated = false; this.hasHit = false;
            }
        } else if (!isIncoming && umpire.state === 'RALLY') {
            this.state = 'IDLE'; this.plan = null;
        }

        // --- 3. UNIFIED EXECUTION ---
        if ((this.state === 'TRACKING' || this.state === 'SWINGING') && this.plan) {
            if (this.hasHit) { this.state = 'IDLE'; this.plan = null; return { x: this.targetX, y: this.targetY, angle: this.targetAngle }; }

            // Recalculate rally shots after bounce
            const isRallyBounce = (umpire.state === 'RALLY' && umpire.validBounces > 0 && umpire.lastHitter !== this.side);
            if (isRallyBounce && !this.hasRecalculated && this.state === 'TRACKING') {
                let newPrediction = this.predictStrikePoint(ball, umpire);
                if (newPrediction.found) {
                    this.plan = newPrediction;
                    this.plannedSwing = this.calculateOptimalSwing(newPrediction.ballState);
                    this.timeToImpact = newPrediction.time;
                }
                this.hasRecalculated = true;
            }

            this.timeToImpact -= dt;
            let swingLeadTime = 0.15;

            if (this.timeToImpact > swingLeadTime) {
                this.state = 'TRACKING';
                let startX = this.plan.x - (this.plannedSwing.vx * swingLeadTime);
                let startY = (umpire.state === 'TOSS') ? this.plan.y - (this.plannedSwing.vy * swingLeadTime) : 0.05;
                this.targetX += (startX - this.targetX) * 25 * dt;
                this.targetY += (startY - this.targetY) * 25 * dt;
                this.targetAngle += (this.plannedSwing.angle - this.targetAngle) * 25 * dt;
            } else if (this.timeToImpact > -0.1) {
                this.state = 'SWINGING';
                let idealX = this.plan.x - (this.plannedSwing.vx * this.timeToImpact);
                let idealY = this.plan.y - (this.plannedSwing.vy * this.timeToImpact);
                this.targetX = idealX + (this.plannedSwing.vx * 0.04);
                this.targetY = idealY + (this.plannedSwing.vy * 0.04);
                this.targetAngle = this.plannedSwing.angle;
            } else {
                this.state = 'IDLE'; this.plan = null;
            }
        } else if (this.state === 'IDLE') {
            this.targetX += (this.baseX - this.targetX) * 5 * dt;
            this.targetY += (0.2 - this.targetY) * 5 * dt;
            this.targetAngle += ((Math.PI * 0.5) - this.targetAngle) * 5 * dt;
        }

        return { x: this.targetX, y: this.targetY, angle: this.targetAngle };
    }
}