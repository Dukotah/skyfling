import { defineMission } from '../define'
export default defineMission({
  id: 'trick', stat: 'tricks', mode: 'run', k: 1.3, icon: '🎪',
  target: (ctx) => Math.max(1, Math.round(1 + Math.floor(ctx.tier / 2))),
  describe: (t) => `Pull off ${t} trick(s)`,
})
