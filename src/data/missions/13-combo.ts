import { defineMission } from '../define'
export default defineMission({
  id: 'combo', stat: 'bestCombo', mode: 'run', k: 1.2, icon: '✨',
  target: (ctx) => Math.max(1, Math.round(3 + ctx.tier)),
  describe: (t) => `Reach a ×${t} combo`,
})
