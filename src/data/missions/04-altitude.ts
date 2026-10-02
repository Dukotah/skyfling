import { defineMission } from '../define'
export default defineMission({
  id: 'altitude', stat: 'alt', mode: 'run', k: 1.1, icon: '⛰️',
  target: (ctx) => Math.max(1, Math.round(40 + 12 * ctx.tier)),
  describe: (t) => `Climb to ${t} m altitude`,
})
