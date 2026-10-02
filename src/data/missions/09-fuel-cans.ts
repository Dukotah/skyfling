import { defineMission } from '../define'
export default defineMission({
  id: 'fuel-cans', stat: 'cans', mode: 'lifetime', k: 1.0, icon: '⛽',
  target: (ctx) => Math.max(1, Math.round(3 + 2 * ctx.tier)),
  describe: (t) => `Grab ${t} fuel cans`,
})
