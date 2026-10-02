import { defineSoftWall } from '../define'
export default defineSoftWall({
  id: 'thin-air', name: 'Thin Air', visual: 'thinair',
  placement: { kind: 'biome', every: 1200, offset: 0 },
  depth: 1200, drag: { base: 0, perIndex: 0 }, downforce: 0, sidePush: 0, yawPush: 0, liftScale: 0.6, fuelBurn: 1,
  breakBonus: { base: 0, perIndex: 0 }, warning: 'THIN AIR ABOVE 400 m', banner: 'STRATOSPHERE',
})
