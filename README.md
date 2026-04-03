# 🏓 Scientific 2D Table Tennis Simulation

A high-fidelity, browser-based 2D table tennis simulation built with ES6 modules. This project focuses on physical accuracy, implementing ITTF standards and advanced aerodynamic effects.

## 🚀 Quick Start

Because this project uses ES6 modules, it must be served via a web server (to avoid CORS issues with `file://` protocols). Or simply try it here: [https://cbrincoveanu.github.io/ping-pong-simulation/](https://cbrincoveanu.github.io/ping-pong-simulation/)

### Using Docker
```bash
docker run -it --rm -p 8080:80 -v $(pwd):/usr/share/nginx/html:ro nginx:alpine
```
Then visit `http://localhost:8080`.

---

## 🔬 Physics Engine Details

The simulation follows the **MKS (Meters, Kilograms, Seconds)** system with a scale of **1 meter = 200 pixels**.

### ITTF Standards
- **Table Length:** 2.74m
- **Net Height:** 0.1525m
- **Ball Diameter:** 40mm
- **Ball Mass:** 2.7g

### Advanced Mechanics
*   **Sub-stepping Integration:** To prevent "tunneling" (objects passing through each other at high speeds), the physics engine runs at **900Hz** (15 sub-steps per 60fps frame).
*   **Aerodynamics:** Implements **Linear Drag** and the **Magnus Effect**. The ball curves in mid-air based on its angular velocity (spin).
*   **Tangential Friction:** Collision resolution uses the ball's moment of inertia to convert linear velocity into spin (and vice-versa) when hitting the racket rubber or the table.
*   **PD Control:** Rackets are governed by a **Proportional-Derivative (Spring-Damper)** controller, ensuring they move with realistic momentum rather than "teleporting" to the mouse position.

---

## 🤖 AI "The Brain"

The AI does not "cheat" by reading the game state directly to teleport. Instead, it uses a **Kinematic Trajectory Solver**:

1.  **Forward-Simulation:** When the ball is hit, the AI runs a "ghost" simulation in its head to predict the exact time and 2D coordinate of the ball's landing.
2.  **The Shooting Method:** The AI tests multiple swing velocities and angles in a fraction of a millisecond to find a solution that clears the net and lands on the opponent's side.
3.  **Closed-Loop Correction:** The AI recalculates its plan the moment the ball bounces on the table to correct for any floating-point inaccuracies or spin deviations.
4.  **Time-Based Execution:** The AI tracks a countdown to impact, aligning its racket along a calculated "runway" to ensure it strikes the ball with the exact planned speed.

---

## 🎮 Controls

*   **Mouse Move:** Move your racket (Left side in H-vs-AI mode).
*   **Scroll Wheel:** Adjust racket angle (Open/Close the face).
*   **Left Click / Space:** Toss the ball for a serve.
    *   *Note:* Per ITTF rules, you must move your racket behind the table baseline to initiate a legal serve.
*   **Game Mode Dropdown:** Switch between **Human vs AI**, **AI vs AI (Spectator)**, and **Self-Play Sandbox**.

---

## 🛠 Project Structure

- `main.js`: Core engine loop and rendering.
- `Ball.js`: Ball state and aerodynamic integration.
- `Racket.js`: Spring-damper movement logic.
- `AI.js`: Predictive trajectory solver and state machine.
- `Umpire.js`: ITTF rule enforcement and scoring.
- `physics.js`: Segment-to-Circle collision and impulse math.
- `audio.js`: Procedural synthesized hit sounds (Web Audio API).
- `constants.js`: Centralized ITTF dimensions and physical coefficients.

---

## 📈 Future Roadmap

- [ ] Implement variable "Rubber" types (Long-pips, Anti-spin).
- [ ] Implement different AI play styles.
- [ ] 3-Game Match flow and "Deuce" logic.
- [ ] Machine Learning integration (TensorFlow.js) to compare Heuristic AI vs Reinforcement Learning.
