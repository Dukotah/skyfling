import { definePickup } from '../define'
export default definePickup({ id: 'shield-orb', name: 'Shield Orb', model: 'proc:shield', radius: 2.4, size: 2.6, effect: { type: 'shield', amount: 1 }, weight: 0.9, magnetic: true, glow: '#9fdfff', spin: 1.5, bob: 0.3, rare: true, sfx: 'shield', altitude: [8, 60] })
