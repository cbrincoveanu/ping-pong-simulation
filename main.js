import { SCALE, TIME_STEP, SUB_STEPS, SUB_DT, RESTITUTION_RACKET, FRICTION_RACKET } from './constants.js';
import { Ball } from './Ball.js';
import { Racket } from './Racket.js';
import { Environment } from './Environment.js';
import { checkCircleSegmentCollision, resolveCollision } from './physics.js';
import { initAudio, playHitSound } from './audio.js';
import { Umpire } from './Umpire.js';
import { AI } from './AI.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiStats = document.getElementById('stats');

let isHumanMode = false;

let width, height, originX, originY;

// --- UI Toggle Logic ---
const toggleUiBtn = document.getElementById('toggleUiBtn');
const collapsibleUi = document.getElementById('collapsibleUi');
const uiContainer = document.getElementById('ui');

let uiVisible = true;

function setUiVisibility(visible) {
    uiVisible = visible;
    if (visible) {
        collapsibleUi.style.display = 'block';
        toggleUiBtn.innerText = 'Hide';
        uiContainer.style.background = 'rgba(15, 15, 25, 0.85)';
    } else {
        collapsibleUi.style.display = 'none';
        toggleUiBtn.innerText = 'Show UI';
        // Make the background more transparent when collapsed so you can see the table better
        uiContainer.style.background = 'rgba(15, 15, 25, 0.4)'; 
    }
}

// Button Click Listener
toggleUiBtn.addEventListener('click', () => {
    setUiVisibility(!uiVisible);
});

// Auto-hide on mobile devices (screens narrower than 800px)
if (window.innerWidth < 800) {
    setUiVisibility(false);
}
// -----------------------

// Initialize Objects
const ball = new Ball(0, 0); 
const env = new Environment();

// Dual Rackets (Left = Red, Right = Blue)
const racketLeft = new Racket('#e74c3c', Math.PI / 4);
const racketRight = new Racket('#3498db', 3 * Math.PI / 4);

// Dual AI
const aiLeft = new AI('left');
const aiRight = new AI('right');

// Mouse state
let mousePhysX = 0;
let mousePhysY = 0;

// Setup Umpire
const umpire = new Umpire(
    (winner, reason) => {
        if (winner !== null) {
            document.getElementById('scoreLeft').innerText = umpire.score.left;
            document.getElementById('scoreRight').innerText = umpire.score.right;
            document.getElementById('statusMsg').innerText = `Point ${winner.toUpperCase()}: ${reason}`;
        } else {
            document.getElementById('statusMsg').innerText = reason;
        }
    },
    (nextServer) => {
        document.getElementById('statusMsg').innerText = `Server: ${nextServer.toUpperCase()} (Toss to start)`;
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

// Human Input
window.addEventListener('mousemove', (e) => {
    mousePhysX = toPhysX(e.clientX);
    mousePhysY = toPhysY(e.clientY);
});
window.addEventListener('wheel', (e) => {
    if (document.getElementById('modeLeft').value === 'human') {
        racketLeft.rotate(e.deltaY * 0.005);
    }
});

function handleTossCommand(racketX) {
    if (umpire.state === 'PRE_SERVE') {
        if (umpire.requestToss(racketX)) {
            ball.vy = 4.0;
        }
    }
}

window.addEventListener('keydown', (e) => {
    initAudio();
    if (e.code === 'Space') {
        // Only allow human toss if it's the human's turn to serve
        if (document.getElementById('modeLeft').value === 'human' && umpire.server === 'left') {
            handleTossCommand(racketLeft.x);
        }
    }
    // Turn wheel based on up/down arrow keys for human player
    if (document.getElementById('modeLeft').value === 'human') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            racketLeft.rotate(-0.1);
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            racketLeft.rotate(0.1);
        }
    }
});
// Allow human toss also by clicking when it's the human's turn to serve
window.addEventListener('click', (e) => {
    initAudio();
    if (document.getElementById('modeLeft').value === 'human' && umpire.server === 'left') {
        handleTossCommand(racketLeft.x);
    }
});


function checkRacketCollision(racket, playerSide) {
    const rSeg = racket.getSegment();
    const relVx = ball.vx - racket.vx;
    const relVy = ball.vy - racket.vy;
    
    const rCol = checkCircleSegmentCollision(ball, rSeg.a, rSeg.b, relVx, relVy);
    if (rCol.hit) {
        ball.x += rCol.normal.x * (rCol.penetration + 0.0001);
        ball.y += rCol.normal.y * (rCol.penetration + 0.0001);
        
        const impact = resolveCollision(ball, { vx: racket.vx, vy: racket.vy }, rCol.normal, RESTITUTION_RACKET, FRICTION_RACKET);
        if (impact > 0) {
            playHitSound('racket', impact);
            umpire.onRacketHit(playerSide);
        }
    }
}

function checkCollisions() {
    for (const seg of env.segments) {
        const col = checkCircleSegmentCollision(ball, seg.a, seg.b, ball.vx, ball.vy);
        if (col.hit) {
            ball.x += col.normal.x * (col.penetration + 0.0001);
            ball.y += col.normal.y * (col.penetration + 0.0001);
            
            const impact = resolveCollision(ball, { vx: 0, vy: 0 }, col.normal, seg.rest, seg.fric);
            if (impact > 0.5) {
                playHitSound('table', impact);
                if (seg.id === 'tableLeft') umpire.onTableBounce('left');
                if (seg.id === 'tableRight') umpire.onTableBounce('right');
                if (seg.id === 'ground') umpire.onGroundHit();
            }
        }
    }

    checkRacketCollision(racketLeft, 'left');
    checkRacketCollision(racketRight, 'right');
}

function update(dt) {
    umpire.update(dt);

    // READ UI CONFIGURATIONS
    const cfgLeft = {
        mode: document.getElementById('modeLeft').value,
        style: document.getElementById('styleLeft').value
    };
    const cfgRight = {
        style: document.getElementById('styleRight').value,
    };

    let targetLeftX, targetLeftY, targetLeftAngle;
    let targetRightX, targetRightY, targetRightAngle;

    // AI logic for Right
    const aiRightCmd = aiRight.update(dt, ball, umpire, handleTossCommand, racketRight, cfgRight);
    targetRightX = aiRightCmd.x; targetRightY = aiRightCmd.y; targetRightAngle = aiRightCmd.angle;

    // Logic for Left (Human vs AI toggle)
    if (cfgLeft.mode === 'human') {
        targetLeftX = mousePhysX; targetLeftY = mousePhysY; targetLeftAngle = racketLeft.angle;
    } else {
        const aiLeftCmd = aiLeft.update(dt, ball, umpire, handleTossCommand, racketLeft, cfgLeft);
        targetLeftX = aiLeftCmd.x; targetLeftY = aiLeftCmd.y; targetLeftAngle = aiLeftCmd.angle;
    }

    for (let i = 0; i < SUB_STEPS; i++) {
        racketLeft.update(SUB_DT, targetLeftX, targetLeftY);
        racketRight.update(SUB_DT, targetRightX, targetRightY);
        
        // Only the AI uses setAngle (Human uses scroll wheel via rotate())
        if (!isHumanMode) racketLeft.setAngle(targetLeftAngle, SUB_DT);
        racketRight.setAngle(targetRightAngle, SUB_DT);

        if (umpire.state === 'PRE_SERVE') {
            const servingRacket = umpire.server === 'left' ? racketLeft : racketRight;
            ball.x = servingRacket.x; ball.y = servingRacket.y + 0.15; // 15cm above racket
            ball.vx = 0; ball.vy = 0; ball.omega = 0;
        } else {
            ball.update(SUB_DT);
            checkCollisions();
        }
    }

    if (Math.abs(ball.x) > 4 || ball.y < -1.5) umpire.onGroundHit();
}

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
    ctx.moveTo(toCanvasX(ball.x - Math.cos(ball.angle) * ball.radius), toCanvasY(ball.y - Math.sin(ball.angle) * ball.radius));
    ctx.lineTo(toCanvasX(ball.x + Math.cos(ball.angle) * ball.radius), toCanvasY(ball.y + Math.sin(ball.angle) * ball.radius));
    ctx.stroke();

    // Draw both rackets using their designated colors
    const rSegL = racketLeft.getSegment();
    drawSegment(rSegL.a, rSegL.b, racketLeft.color, 6);

    const rSegR = racketRight.getSegment();
    drawSegment(rSegR.a, rSegR.b, racketRight.color, 6);

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