import { defineSoftWall } from '../define'
export default defineSoftWall({
  id: 'ash-cloud', name: 'Ash Cloud', visual: 'ash',
  placement: { kind: 'biome', every: 600, offset: 420 },
  depth: 80, drag: { base: 6.3, perIndex: 2.4 }, downforce: 0, sidePush: 0, yawPush: 0, liftScale: 1, fuelBurn: 2,
  breakBonus: { base: 80, perIndex: 60 }, warning: 'ASH CLOUD — FUEL BURNS 2×', banner: 'ASH CLEARED',
})
