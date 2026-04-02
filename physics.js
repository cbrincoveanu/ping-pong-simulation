export function getClosestPointOnSegment(p, a, b) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ap = { x: p.x - a.x, y: p.y - a.y };
    let t = (ap.x * ab.x + ap.y * ab.y) / (ab.x * ab.x + ab.y * ab.y);
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

export function checkCircleSegmentCollision(circle, segA, segB, relVx, relVy) {
    const closest = getClosestPointOnSegment(circle, segA, segB);
    const dx = circle.x - closest.x;
    const dy = circle.y - closest.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq <= circle.radius * circle.radius) {
        let dist = Math.sqrt(distSq);
        let nx, ny, penetration;

        // Edge case: Center of ball is exactly on the line
        if (dist === 0) {
            nx = -(segB.y - segA.y);
            ny = (segB.x - segA.x);
            const len = Math.sqrt(nx*nx + ny*ny);
            nx /= len; ny /= len;
            penetration = circle.radius;
        } else {
            nx = dx / dist;
            ny = dy / dist;
            penetration = circle.radius - dist;
        }

        // TUNNELING FIX: Ensure the normal always opposes the velocity
        // If it doesn't, it means the ball teleported halfway through the racket between frames
        const vn = relVx * nx + relVy * ny;
        if (vn > 0) {
            nx = -nx;
            ny = -ny;
            // Push the ball all the way back across the midline
            penetration = circle.radius + dist; 
        }

        return { hit: true, normal: { x: nx, y: ny }, penetration, contactPoint: closest };
    }
    return { hit: false };
}

export function resolveCollision(ball, surfaceVel, normal, restitution, friction) {
    const vx_rel = ball.vx - surfaceVel.vx;
    const vy_rel = ball.vy - surfaceVel.vy;

    // Normal Impulse
    const v_n_linear = vx_rel * normal.x + vy_rel * normal.y;
    
    // If moving away, return 0 impact
    if (v_n_linear >= 0) return 0; 

    const r_vec_x = -ball.radius * normal.x;
    const r_vec_y = -ball.radius * normal.y;

    const v_spin_x = -ball.omega * r_vec_y;
    const v_spin_y = ball.omega * r_vec_x;

    const v_rel_total_x = vx_rel + v_spin_x;
    const v_rel_total_y = vy_rel + v_spin_y;

    const tx = -normal.y;
    const ty = normal.x;
    const v_t = v_rel_total_x * tx + v_rel_total_y * ty;

    const I = (2 / 3) * ball.mass * ball.radius * ball.radius;
    const invMass = 1 / ball.mass;

    // Apply Bounce
    const j_n = -(1 + restitution) * v_n_linear / invMass;
    ball.vx += (j_n * normal.x) * invMass;
    ball.vy += (j_n * normal.y) * invMass;

    // 2. Tangential Impulse (Friction / Spin Transfer)
    const r_cross_t = r_vec_x * ty - r_vec_y * tx;
    const effective_inv_mass_t = invMass + (r_cross_t * r_cross_t) / I;
    
    let j_t = -v_t / effective_inv_mass_t;
    const max_friction = friction * j_n;
    
    // Clamp to Coulomb friction limit (Slipping vs Gripping)
    j_t = Math.max(-max_friction, Math.min(max_friction, j_t));

    ball.vx += (j_t * tx) * invMass;
    ball.vy += (j_t * ty) * invMass;
    ball.omega += (r_cross_t * j_t) / I;

    // RETURN the absolute impact velocity so we can scale the sound volume
    return Math.abs(v_n_linear);
}