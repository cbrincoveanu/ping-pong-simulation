import { TABLE_LENGTH, TABLE_HEIGHT, NET_HEIGHT, RESTITUTION_TABLE, FRICTION_TABLE, RESTITUTION_NET, FRICTION_NET, RESTITUTION_GROUND, FRICTION_GROUND } from './constants.js';

export class Environment {
    constructor() {
        const halfT = TABLE_LENGTH / 2;
        const groundY = -TABLE_HEIGHT;

        this.segments = [
            // Table Left Half
            { a: { x: -halfT, y: 0 }, b: { x: 0, y: 0 }, rest: RESTITUTION_TABLE, fric: FRICTION_TABLE },
            // Table Right Half
            { a: { x: 0, y: 0 }, b: { x: halfT, y: 0 }, rest: RESTITUTION_TABLE, fric: FRICTION_TABLE },
            // Net (Left, Right, Top)
            { a: { x: -0.005, y: 0 }, b: { x: -0.005, y: NET_HEIGHT }, rest: RESTITUTION_NET, fric: FRICTION_NET },
            { a: { x: 0.005, y: 0 }, b: { x: 0.005, y: NET_HEIGHT }, rest: RESTITUTION_NET, fric: FRICTION_NET },
            { a: { x: -0.005, y: NET_HEIGHT }, b: { x: 0.005, y: NET_HEIGHT }, rest: RESTITUTION_NET, fric: FRICTION_NET },
            // Ground
            { a: { x: -5, y: groundY }, b: { x: 5, y: groundY }, rest: RESTITUTION_GROUND, fric: FRICTION_GROUND }
        ];
    }
}