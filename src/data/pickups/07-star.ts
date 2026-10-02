import { definePickup } from '../define'
export default definePickup({ id: 'star', name: '×2 Star', model: 'proc:star', radius: 2.4, size: 2.6, effect: { type: 'multiplier', factor: 2, seconds: 9 }, weight: 0.8, magnetic: true, glow: '#ffffff', spin: 2, bob: 0.3, rare: true, sfx: 'star', altitude: [10, 70] })
