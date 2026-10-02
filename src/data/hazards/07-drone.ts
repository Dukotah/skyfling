import { defineHazard } from '../define'
export default defineHazard({ id: 'drone', name: 'Patrol Drone', model: 'drone', radius: 1.8, size: 3.4, effect: { type: 'slow', factor: 0.6 }, moveSpeed: 10, clip: 'Fly', nearMiss: 5.5, altitude: [14, 80], sfx: 'drone' })
