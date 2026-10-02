import { defineMission } from '../define'
export default defineMission({
  id: 'biome-reach', stat: 'biomeIdx', mode: 'run', k: 1.5, icon: '🗺️',
  target: (ctx) => Math.max(1, Math.round(2 + Math.floor(ctx.tier / 2))),
  describe: (t) => `Reach biome #${t}`,
})
