import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'nitro', name: 'Nitro', icon: '🔥', blurb: 'Bigger boost tank that drains slower and kicks harder.', formula: 'boost = 16 + 1.2·L · tank = 0.4 + 0.06·L', maxLevel: 10 })
