import { defineHazard } from '../define'
export default defineHazard({ id: 'cable', name: 'Ski-Lift Cable', model: 'proc:cable', radius: 0.8, size: 160, effect: { type: 'slow', factor: 0.5 }, nearMiss: 4, altitude: [18, 40], sfx: 'cable' })
