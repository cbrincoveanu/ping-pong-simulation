import { TABLE_LENGTH } from './constants.js';

export class Umpire {
    constructor(onUIUpdate, onResetTurn) {
        this.score = { left: 0, right: 0 };
        this.server = 'left';
        this.pointsPlayed = 0;
        
        this.onUIUpdate = onUIUpdate;
        this.onResetTurn = onResetTurn;
        
        this.resetState();
    }

    resetState() {
        this.state = 'PRE_SERVE'; // Ball is magically pinned to racket
        this.lastHitter = null;
        this.validBounces = 0;
        this.pointActive = true;
        this.delayTimer = 0;
    }

    update(dt) {
        if (!this.pointActive) {
            this.delayTimer -= dt;
            if (this.delayTimer <= 0) {
                this.resetState();
                this.onResetTurn(this.server);
            }
        }
    }

    requestToss(racketX) {
        if (this.state !== 'PRE_SERVE') return false;
        
        const tableEdge = TABLE_LENGTH / 2;
        // Check if racket is behind the correct baseline
        const isValid = this.server === 'left' ? racketX < -tableEdge : racketX > tableEdge;
        
        if (!isValid) {
            this.onUIUpdate(null, `Server is ${this.server.toUpperCase()}: Move behind table!`);
            return false;
        }
        
        this.state = 'TOSS';
        this.onUIUpdate(null, "Toss! Hit the ball on the way down.");
        return true;
    }

    awardPoint(winner, reason) {
        if (!this.pointActive) return;
        
        this.score[winner]++;
        this.pointActive = false;
        this.pointsPlayed++;
        
        // Serve switches every 2 points
        if (this.pointsPlayed % 2 === 0) {
            this.server = this.server === 'left' ? 'right' : 'left';
        }

        this.delayTimer = 2.5; // Wait before next serve
        this.onUIUpdate(winner, reason);
    }

    getOpponent(player) {
        return player === 'left' ? 'right' : 'left';
    }

    onRacketHit(player) {
        if (!this.pointActive || this.state === 'PRE_SERVE') return;
        if (this.lastHitter === player && this.validBounces === 0) return;

        if (this.state === 'TOSS') {
            if (player !== this.server) {
                this.awardPoint(this.getOpponent(player), "Wrong player hit the toss!");
                return;
            }
            this.state = 'SERVE';
            this.lastHitter = player;
            this.validBounces = 0;
            this.onUIUpdate(null, "Serve in play!");
            return;
        }

        this.lastHitter = player;
        this.validBounces = 0;
    }

    onTableBounce(side) {
        if (!this.pointActive) return;

        if (this.state === 'TOSS') {
            this.awardPoint(this.getOpponent(this.server), "Failed to hit toss");
            return;
        }
        if (!this.lastHitter) return;

        if (this.state === 'SERVE') {
            if (this.validBounces === 0) {
                if (side !== this.lastHitter) {
                    this.awardPoint(this.getOpponent(this.lastHitter), "Serve must bounce on own side first");
                } else {
                    this.validBounces++;
                }
            } else if (this.validBounces === 1) {
                if (side === this.lastHitter) {
                    this.awardPoint(this.getOpponent(this.lastHitter), "Double bounce on serve");
                } else {
                    this.state = 'RALLY';
                    this.validBounces = 1;
                }
            }
        } 
        else if (this.state === 'RALLY') {
            if (this.validBounces === 0) {
                if (side === this.lastHitter) {
                    this.awardPoint(this.getOpponent(this.lastHitter), "Hit own side of table");
                } else {
                    this.validBounces++;
                }
            } else if (this.validBounces >= 1) {
                this.awardPoint(this.lastHitter, "Winner!");
            }
        }
    }

    onGroundHit() {
        if (!this.pointActive) return;
        if (this.state === 'TOSS') {
            this.awardPoint(this.getOpponent(this.server), "Failed to hit toss");
            return;
        }
        if (!this.lastHitter) return;

        if (this.validBounces === 0) {
            this.awardPoint(this.getOpponent(this.lastHitter), "Out of bounds");
        } else {
            this.awardPoint(this.lastHitter, "Point!");
        }
    }
}