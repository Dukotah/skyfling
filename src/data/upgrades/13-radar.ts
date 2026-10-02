import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'radar', name: 'Coin Radar', icon: '📡', blurb: 'See coins and rings through hills from farther away.', formula: 'radar range = 60 + 14·L m', maxLevel: 10 })
