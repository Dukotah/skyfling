import { defineMission } from '../define'
export default defineMission({
  id: 'coins', stat: 'coins', mode: 'run', k: 1.0, icon: '🪙',
  target: (ctx) => Math.max(1, Math.round(25 + 12 * ctx.tier + Math.round(ctx.best * 0.04))),
  describe: (t) => `Collect ${t} coins in one flight`,
})
