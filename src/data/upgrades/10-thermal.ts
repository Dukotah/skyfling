import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'thermal', name: 'Thermal Wings', icon: '🌀', blurb: 'Thermals lift you harder.', formula: 'thermal lift × (1.2 + 0.05·L)', maxLevel: 10 })
