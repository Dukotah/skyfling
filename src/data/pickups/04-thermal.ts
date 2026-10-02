import { definePickup } from '../define'
export default definePickup({ id: 'thermal', name: 'Thermal', model: 'proc:thermal', radius: 9, size: 18, effect: { type: 'thermal', lift: 11, radius: 9, height: 90 }, weight: 1.6, glow: '#fff1b8', sfx: 'thermal', altitude: [0, 0] })
