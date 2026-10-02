import { definePickup } from '../define'
export default definePickup({ id: 'golden-ring', name: 'Golden Ring', model: 'proc:goldring', radius: 4, size: 8, effect: { type: 'multiplier', factor: 3, seconds: 10 }, weight: 0.5, pattern: 'chain', glow: '#ffd23f', spin: 0.8, rare: true, sfx: 'ring', altitude: [12, 80] })
