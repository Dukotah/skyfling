import { defineMission } from '../define'
export default defineMission({
  id: 'near-miss', stat: 'near', mode: 'run', k: 1.2, icon: '💨',
  target: (ctx) => Math.max(1, Math.round(2 + ctx.tier)),
  describe: (t) => `Dodge ${t} hazards by a hair`,
})
