import { defineHazard } from '../define'
export default defineHazard({ id: 'ice-crystal', name: 'Ice Crystal', model: 'proc:icecrystal', radius: 2.4, size: 6, effect: { type: 'slow', factor: 0.72 }, nearMiss: 6, altitude: [4, 30], sfx: 'ice' })
