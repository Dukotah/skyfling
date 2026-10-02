import { defineMission } from '../define'
export default defineMission({
  id: 'perfect', stat: 'pstreak', mode: 'run', k: 1.3, icon: '🎯',
  target: (ctx) => Math.max(1, Math.round(1 + Math.floor(ctx.tier / 2))),
  describe: (t) => `Nail ${t} PERFECT launch(es) in a row`,
})
