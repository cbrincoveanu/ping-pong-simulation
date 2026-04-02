let audioCtx;

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

export function playHitSound(type, impactVelocity) {
    if (!audioCtx) return;

    // Ignore micro-bounces to prevent audio clipping
    if (impactVelocity < 0.5) return; 

    // Cap velocity for volume scaling
    const volume = Math.min(impactVelocity / 10, 1.0);

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'racket') {
        // High-pitched, crisp "Ping" (Plastic on Rubber)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800 + Math.min(impactVelocity * 50, 200), now); // Steady high pitch
        
        gain.gain.setValueAtTime(volume * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.005); 
        
        osc.start(now);
        osc.stop(now + 0.001);
    } 
    else if (type === 'table') {
        // Woody, hollow "Pong" (Plastic on Wood/Floor)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000 + Math.min(impactVelocity * 50, 200), now); // Medium-high steady pitch
        
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.0025);
        
        osc.start(now);
        osc.stop(now + 0.001);
    }
}