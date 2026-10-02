import { defineHazard } from '../define'
export default defineHazard({ id: 'seagull', name: 'Seagull Flock', model: 'bird-flamingo', radius: 1.6, size: 3, effect: { type: 'slow', factor: 0.66 }, moveSpeed: 8, clip: 'flamingo_flyA_', nearMiss: 5, altitude: [10, 60], sfx: 'bird' })
