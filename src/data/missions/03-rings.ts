import { defineMission } from '../define'
export default defineMission({
  id: 'rings', stat: 'rings', mode: 'run', k: 1.1, icon: '⭕',
  target: (ctx) => Math.max(1, Math.round(2 + ctx.tier)),
  describe: (t) => `Fly through ${t} rings`,
})
