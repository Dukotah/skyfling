import { defineMission } from '../define'
export default defineMission({
  id: 'distance', stat: 'dist', mode: 'run', k: 1.0, icon: '📏',
  target: (ctx) => Math.max(1, Math.round(Math.round((120 + 0.7 * ctx.best + 90 * ctx.tier) / 10) * 10)),
  describe: (t) => `Fly ${t} m in one flight`,
})
