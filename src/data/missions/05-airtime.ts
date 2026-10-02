import { defineMission } from '../define'
export default defineMission({
  id: 'airtime', stat: 'air', mode: 'run', k: 1.0, icon: '⏱️',
  target: (ctx) => Math.max(1, Math.round(8 + 3 * ctx.tier)),
  describe: (t) => `Stay airborne ${t} s`,
})
