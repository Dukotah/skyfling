import { defineMission } from '../define'
export default defineMission({
  id: 'storm-break', stat: 'broke', mode: 'lifetime', k: 1.6, icon: '⛈️',
  target: (ctx) => Math.max(1, Math.round(1 + Math.floor(ctx.tier / 2))),
  describe: (t) => `Break ${t} storm front(s)`,
})
