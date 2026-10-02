import { defineUpgrade } from '../define'
export default defineUpgrade({ id: 'airframe', name: 'Airframe', icon: '✈️', blurb: 'Slipperier body: less drag, sharper turns, shrugs off birds.', formula: 'drag ÷ (1 + 0.1·L) · turn = 1.4 + 0.08·L', maxLevel: 10 })
