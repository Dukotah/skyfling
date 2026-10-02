import { definePickup } from '../define'
export default definePickup({ id: 'coin-fountain', name: 'Coin Fountain', model: 'chest', radius: 2.6, size: 2.8, effect: { type: 'fountain', coins: 30 }, weight: 0.25, glow: '#ffd23f', bob: 0.2, rare: true, sfx: 'fountain', altitude: [6, 40] })
