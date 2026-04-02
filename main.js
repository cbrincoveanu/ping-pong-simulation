import { SCALE, TIME_STEP, SUB_STEPS, SUB_DT, RESTITUTION_RACKET, FRICTION_RACKET, RESTITUTION_NET, FRICTION_NET } from './constants.js';
import { Ball } from './Ball.js';
import { Racket } from './Racket.js';
import { Environment } from './Environment.js';
import { checkCircleSegmentCollision, resolveCollision } from './physics.js';
import { initAudio, playHitSound } from './audio.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiStats = document.getElementById('stats');

let width, height, originX, originY;

// Initialize Objects
const ball = new Ball(1.0, 1.0); // Drop from above right table
const racket = new Racket();
const env = new Environment();

// Mouse state in Physics Coordinates
let mousePhysX = 0;
let mousePhysY = 0;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    // Origin: Top-Center of the table, roughly middle of screen
    originX = width / 2;
    originY = height * 0.6; 
}
window.addEventListener('resize', resize);
resize();

// --- Coordinate Transformations ---
function toPhysX(cx) { return (cx - originX) / SCALE; }
function toPhysY(cy) { return (originY - cy) / SCALE; } // Canvas Y is inverted
function toCanvasX(px) { return originX + px * SCALE; }
function toCanvasY(py) { return originY - py * SCALE; } // Canvas Y is inverted

// --- Controls ---
window.addEventListener('mousemove', (e) => {
    mousePhysX = toPhysX(e.clientX);
    mousePhysY = toPhysY(e.clientY);
});
window.addEventListener('wheel', (e) => {
    racket.rotate(e.deltaY * 0.005);
});
window.addEventListener('mousedown', () => {
    initAudio();
});
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        ball.reset(mousePhysX, mousePhysY + 1); // Drop from slightly above mouse
    }
});

// --- Physics Loop ---
let accumulator = 0;
let lastTime = performance.now();

function checkCollisions() {
    // 1. Ball vs Environment
    for (const seg of env.segments) {
        const col = checkCircleSegmentCollision(ball, seg.a, seg.b, ball.vx, ball.vy);
        if (col.hit) {
            ball.x += col.normal.x * (col.penetration + 0.0001);
            ball.y += col.normal.y * (col.penetration + 0.0001);
            
            // Capture impact velocity
            const impact = resolveCollision(ball, { vx: 0, vy: 0 }, col.normal, seg.rest, seg.fric);
            if (impact > 0) {
                playHitSound('table', impact);
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
        
        // Capture impact velocity
        const impact = resolveCollision(ball, { vx: racket.vx, vy: racket.vy }, rCol.normal, RESTITUTION_RACKET, FRICTION_RACKET);
        if (impact > 0) {
            playHitSound('racket', impact);
        }
    }
}

function update(dt) {
    for (let i = 0; i < SUB_STEPS; i++) {
        // The racket naturally sweeps toward the mouse inside the sub-step now!
        racket.update(SUB_DT, mousePhysX, mousePhysY);
        ball.update(SUB_DT);
        checkCollisions();
    }
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
    ctx.clearRect(0, 0, width, height);
    env.segments.forEach(seg => drawSegment(seg.a, seg.b, '#4ecca3', 3));

    // Draw Ball
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(toCanvasX(ball.x), toCanvasY(ball.y), ball.radius * SCALE, 0, Math.PI * 2);
    ctx.fill();

    // Draw Spin indicator properly using our new `angle` property
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

function loop(time) {
    const frameTime = (time - lastTime) / 1000;
    lastTime = time;
    
    // Clamp frametime to avoid spiral of death on lag
    accumulator += Math.min(frameTime, 0.1); 

    while (accumulator >= TIME_STEP) {
        update(TIME_STEP);
        accumulator -= TIME_STEP;
    }

    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);