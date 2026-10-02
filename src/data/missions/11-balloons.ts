import { defineMission } from '../define'
export default defineMission({
  id: 'balloons', stat: 'balloons', mode: 'lifetime', k: 1.1, icon: '🎈',
  target: (ctx) => Math.max(1, Math.round(2 + ctx.tier)),
  describe: (t) => `Bounce off ${t} balloons`,
})
