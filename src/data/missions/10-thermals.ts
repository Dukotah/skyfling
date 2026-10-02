import { defineMission } from '../define'
export default defineMission({
  id: 'thermals', stat: 'therms', mode: 'lifetime', k: 1.0, icon: '🌀',
  target: (ctx) => Math.max(1, Math.round(2 + 2 * ctx.tier)),
  describe: (t) => `Ride ${t} thermals`,
})
