import { defineHazard } from '../define'
export default defineHazard({ id: 'bird', name: 'Bird', model: 'bird-stork', radius: 1.6, size: 3.2, effect: { type: 'slow', factor: 0.62 }, moveSpeed: 6, clip: 'storkFly_B_', nearMiss: 5, altitude: [12, 70], sfx: 'bird' })
