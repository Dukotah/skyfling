import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'luck', name: 'Lucky Charm', icon: '🍀', blurb: 'Coins are worth more and rare pickups show up more often.', formula: 'coins × (1 + 0.07·L) · rare × (1 + 0.1·L)', maxLevel: 10 })
