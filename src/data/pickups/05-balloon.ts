import { definePickup } from '../define'
export default definePickup({ id: 'balloon', name: 'Balloon', model: 'balloon', radius: 5, size: 11, effect: { type: 'bounce', speed: 1.12, pitch: 0.42 }, weight: 1.4, glow: '#ff9ac0', bob: 0.8, sfx: 'pop', altitude: [10, 70] })
