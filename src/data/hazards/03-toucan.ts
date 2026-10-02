import { defineHazard } from '../define'
export default defineHazard({ id: 'toucan', name: 'Toucan Flock', model: 'bird-parrot', radius: 1.5, size: 2.6, effect: { type: 'slow', factor: 0.66 }, moveSpeed: 9, clip: 'parrot_A_', nearMiss: 5, altitude: [12, 60], sfx: 'bird' })
