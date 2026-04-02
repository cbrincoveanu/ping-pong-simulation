import { SCALE, TIME_STEP, SUB_STEPS, SUB_DT, RESTITUTION_RACKET, FRICTION_RACKET } from './constants.js';
import { Ball } from './Ball.js';
import { Racket } from './Racket.js';
import { Environment } from './Environment.js';
import { checkCircleSegmentCollision, resolveCollision } from './physics.js';
import { initAudio, playHitSound } from './audio.js';
import { Umpire } from './Umpire.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiStats = document.getElementById('stats');

let width, height, originX, originY;

// Initialize Objects
const ball = new Ball(-1.0, 0.5); // Spawn on left side initially
const racket = new Racket();
const env = new Environment();

// Mouse state
let mousePhysX = 0;
let mousePhysY = 0;

const umpire = new Umpire(
    (winner, reason) => {
        if (winner !== null) { // A point was scored
            document.getElementById('scoreLeft').innerText = umpire.score.left;
            document.getElementById('scoreRight').innerText = umpire.score.right;
            document.getElementById('statusMsg').innerText = `Point ${winner.toUpperCase()}: ${reason}`;
        } else { // Just a status update (like "Toss!")
            document.getElementById('statusMsg').innerText = reason;
        }
    },
    (nextServer) => {
        // Point reset callback
        document.getElementById('statusMsg').innerText = `Server: ${nextServer.toUpperCase()} (Move behind table and Click to Toss)`;
    }
);

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    originX = width / 2;
    originY = height * 0.6; 
}
window.addEventListener('resize', resize);
resize();

function toPhysX(cx) { return (cx - originX) / SCALE; }
function toPhysY(cy) { return (originY - cy) / SCALE; }
function toCanvasX(px) { return originX + px * SCALE; }
function toCanvasY(py) { return originY - py * SCALE; }

// Input
window.addEventListener('mousemove', (e) => {
    mousePhysX = toPhysX(e.clientX);
    mousePhysY = toPhysY(e.clientY);
});
window.addEventListener('wheel', (e) => {
    racket.rotate(e.deltaY * 0.005);
});

function handleToss() {
    if (umpire.state === 'PRE_SERVE') {
        if (umpire.requestToss(racket.x)) {
            ball.vy = 4.0; // Toss velocity (~0.8 meters high)
        }
    }
}

window.addEventListener('mousedown', () => { 
    initAudio(); 
    handleToss(); 
});
window.addEventListener('keydown', (e) => {
    initAudio();
    if (e.code === 'Space') handleToss();
});

// --- Physics Loop ---
function checkCollisions() {
    // 1. Ball vs Environment
    for (const seg of env.segments) {
        const col = checkCircleSegmentCollision(ball, seg.a, seg.b, ball.vx, ball.vy);
        if (col.hit) {
            ball.x += col.normal.x * (col.penetration + 0.0001);
            ball.y += col.normal.y * (col.penetration + 0.0001);
            
            const impact = resolveCollision(ball, { vx: 0, vy: 0 }, col.normal, seg.rest, seg.fric);
            if (impact > 0.5) {
                playHitSound('table', impact);
                
                // NOTIFY UMPIRE
                if (seg.id === 'tableLeft') umpire.onTableBounce('left');
                if (seg.id === 'tableRight') umpire.onTableBounce('right');
                if (seg.id === 'ground') umpire.onGroundHit();
            }
        }
    }

    // 2. Ball vs Racket
    const racketSeg = racket.getSegment();
    const relVx = ball.vx - racket.vx;
    const relVy = ball.vy - racket.vy;
    
    const rCol = checkCircleSegmentCollision(ball, racketSeg.a, racketSeg.b, relVx, relVy);
    if (rCol.hit) {
        ball.x += rCol.normal.x * (rCol.penetration + 0.0001);
        ball.y += rCol.normal.y * (rCol.penetration + 0.0001);
        
        const impact = resolveCollision(ball, { vx: racket.vx, vy: racket.vy }, rCol.normal, RESTITUTION_RACKET, FRICTION_RACKET);
        if (impact > 0) {
            playHitSound('racket', impact);
            
            // NOTIFY UMPIRE: Determine player by which side of the net the racket is on
            const playerSide = racket.x < 0 ? 'left' : 'right';
            umpire.onRacketHit(playerSide);
        }
    }
}

// Out of Bounds Safety Net
function checkOutOfBounds() {
    if (Math.abs(ball.x) > 4 || ball.y < -1.5) {
        umpire.onGroundHit(); // Treat flying off-screen same as hitting the ground
    }
}

function update(dt) {
    umpire.update(dt);

    for (let i = 0; i < SUB_STEPS; i++) {
        racket.update(SUB_DT, mousePhysX, mousePhysY);
        
        if (umpire.state === 'PRE_SERVE') {
            // Pin the ball 25cm above the racket
            ball.x = racket.x;
            ball.y = racket.y + 0.25; 
            ball.vx = 0;
            ball.vy = 0;
            ball.omega = 0;
            // Skip collision checks so the racket doesn't hit it yet
        } else {
            ball.update(SUB_DT);
            checkCollisions();
        }
    }
    checkOutOfBounds();
}

// --- Render Loop ---
function drawSegment(a, b, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(a.x), toCanvasY(a.y));
    ctx.lineTo(toCanvasX(b.x), toCanvasY(b.y));
    ctx.stroke();
}

function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    env.segments.forEach(seg => {
        // Color net white, ground dark, table green
        let color = '#4ecca3';
        if (seg.id === 'net') color = '#ecf0f1';
        if (seg.id === 'ground') color = '#2c3e50';
        drawSegment(seg.a, seg.b, color, 3);
    });

    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(toCanvasX(ball.x), toCanvasY(ball.y), ball.radius * SCALE, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
        toCanvasX(ball.x - Math.cos(ball.angle) * ball.radius),
        toCanvasY(ball.y - Math.sin(ball.angle) * ball.radius)
    );
    ctx.lineTo(
        toCanvasX(ball.x + Math.cos(ball.angle) * ball.radius),
        toCanvasY(ball.y + Math.sin(ball.angle) * ball.radius)
    );
    ctx.stroke();

    const rSeg = racket.getSegment();
    drawSegment(rSeg.a, rSeg.b, '#e67e22', 6);

    uiStats.innerHTML = `Speed: ${(Math.sqrt(ball.vx**2 + ball.vy**2)).toFixed(1)} m/s<br>` +
                        `Spin: ${((ball.omega * 60) / (2 * Math.PI)).toFixed(0)} RPM`;
}

let accumulator = 0;
let lastTime = performance.now();

function loop(time) {
    const frameTime = (time - lastTime) / 1000;
    lastTime = time;
    accumulator += Math.min(frameTime, 0.1); 

    while (accumulator >= TIME_STEP) {
        update(TIME_STEP);
        accumulator -= TIME_STEP;
    }

    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);