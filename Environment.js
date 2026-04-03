import { TABLE_LENGTH, TABLE_HEIGHT, NET_HEIGHT, GROUND_LENGTH, RESTITUTION_TABLE, FRICTION_TABLE, RESTITUTION_GROUND, FRICTION_GROUND } from './constants.js';

export const RESTITUTION_NET = 0.2;
export const FRICTION_NET = 0.5;

export class Environment {
    constructor() {
        const halfT = TABLE_LENGTH / 2;
        const groundY = -TABLE_HEIGHT;

        this.segments = [
            // Added ID tags to track game state
            { id: 'tableLeft', a: { x: -halfT, y: 0 }, b: { x: 0, y: 0 }, rest: RESTITUTION_TABLE, fric: FRICTION_TABLE },
            { id: 'tableRight', a: { x: 0, y: 0 }, b: { x: halfT, y: 0 }, rest: RESTITUTION_TABLE, fric: FRICTION_TABLE },
            
            { id: 'net', a: { x: -0.005, y: 0 }, b: { x: -0.005, y: NET_HEIGHT }, rest: RESTITUTION_NET, fric: FRICTION_NET },
            { id: 'net', a: { x: 0.005, y: 0 }, b: { x: 0.005, y: NET_HEIGHT }, rest: RESTITUTION_NET, fric: FRICTION_NET },
            { id: 'net', a: { x: -0.005, y: NET_HEIGHT }, b: { x: 0.005, y: NET_HEIGHT }, rest: RESTITUTION_NET, fric: FRICTION_NET },
            
            { id: 'ground', a: { x: -GROUND_LENGTH, y: groundY }, b: { x: GROUND_LENGTH, y: groundY }, rest: RESTITUTION_GROUND, fric: FRICTION_GROUND }
        ];
    }
}