import { definePickup } from '../define'
export default definePickup({ id: 'fuel-can', name: 'Fuel Can', model: 'proc:fuelcan', radius: 2.2, size: 2.2, effect: { type: 'fuel', seconds: 2.5 }, weight: 2.2, magnetic: true, glow: '#ff6b4a', bob: 0.3, spin: 1.2, sfx: 'fuel', altitude: [8, 50] })
