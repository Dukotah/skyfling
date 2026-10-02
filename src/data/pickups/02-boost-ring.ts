import { definePickup } from '../define'
export default definePickup({ id: 'boost-ring', name: 'Boost Ring', model: 'proc:ring', radius: 4.2, size: 8, effect: { type: 'speed', amount: 14, nitro: 0.15 }, weight: 3, glow: '#5fd3b5', spin: 0.6, sfx: 'ring', altitude: [10, 80] })
