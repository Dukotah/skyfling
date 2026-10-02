import { defineMission } from '../define'
export default defineMission({
  id: 'land-past', stat: 'landPast', mode: 'run', k: 1.2, icon: '🛬',
  target: (ctx) => Math.max(1, Math.round(Math.round((100 + 0.6 * ctx.best + 60 * ctx.tier) / 10) * 10)),
  describe: (t) => `Land safely past ${t} m`,
})
