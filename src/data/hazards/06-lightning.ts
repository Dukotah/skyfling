import { defineHazard } from '../define'
export default defineHazard({ id: 'lightning', name: 'Lightning Strike', model: 'proc:lightning', radius: 3.5, size: 120, effect: { type: 'slow', factor: 0.6 }, telegraph: 1, nearMiss: 8, altitude: [0, 120], sfx: 'thunder' })
