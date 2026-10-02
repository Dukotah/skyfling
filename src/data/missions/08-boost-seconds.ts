import { defineMission } from '../define'
export default defineMission({
  id: 'boost-seconds', stat: 'boostT', mode: 'run', k: 1.0, icon: '🔥',
  target: (ctx) => Math.max(1, Math.round(3 + 1.5 * ctx.tier)),
  describe: (t) => `Boost for ${t} s total`,
})
