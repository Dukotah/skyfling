import { defineHazard } from '../define'
export default defineHazard({ id: 'geyser', name: 'Lava Geyser', model: 'proc:geyser', radius: 3, size: 40, effect: { type: 'burn', fuel: 0.5, slow: 0.8 }, telegraph: 0.8, nearMiss: 7, altitude: [0, 40], sfx: 'geyser' })
