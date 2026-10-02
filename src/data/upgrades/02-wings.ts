import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'wings', name: 'Wings', icon: '🪽', blurb: 'Longer wings: glide farther, stall later, less drag.', formula: 'stall = 14 − 0.6·L · glide = 7 + 0.9·L · drag ÷ (1 + 0.08·L)', maxLevel: 10 })
