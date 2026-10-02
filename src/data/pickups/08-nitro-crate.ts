import { definePickup } from '../define'
export default definePickup({ id: 'nitro-crate', name: 'Nitro Crate', model: 'crate', radius: 2.2, size: 2.4, effect: { type: 'nitro', amount: 0.5 }, weight: 1.2, magnetic: true, glow: '#ff6b4a', spin: 0.8, bob: 0.25, sfx: 'crate', altitude: [8, 50] })
