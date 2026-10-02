import { definePickup } from '../define'
export default definePickup({ id: 'coin', name: 'Coin', model: 'coin', radius: 1.5, size: 1.2, effect: { type: 'coins', amount: 1 }, weight: 10, pattern: 'line', magnetic: true, glow: '#ffd23f', spin: 2.4, bob: 0.2, sfx: 'coin', altitude: [6, 60] })
