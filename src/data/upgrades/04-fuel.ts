import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'fuel', name: 'Fuel Tank', icon: '⛽', blurb: 'Seconds of engine before you glide.', formula: 'fuel = 2.5 + 1.4·L s', maxLevel: 10 })
