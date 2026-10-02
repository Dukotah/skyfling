import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'magnet', name: 'Magnet', icon: '🧲', blurb: 'Coins fly to you from farther away.', formula: 'radius = 5 + 2.2·L m', maxLevel: 10 })
