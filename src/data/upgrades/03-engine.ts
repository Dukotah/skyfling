import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'engine', name: 'Engine', icon: '⚙️', blurb: 'More thrust while the tank lasts, and a harder boost.', formula: 'thrust = 5 + 2.2·L · boost + 0.5·L', maxLevel: 10 })
