import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'armor', name: 'Armor', icon: '🛡️', blurb: 'Shields that turn a crash into a bounce.', formula: 'shields = ⌊(L + 2) / 3⌋ → 0,1,1,1,2,2,2,3,3,3,4', maxLevel: 10 })
