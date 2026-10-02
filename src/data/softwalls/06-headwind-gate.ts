import { defineSoftWall } from '../define'
export default defineSoftWall({
  id: 'headwind-gate', name: 'Wind Gate', visual: 'gate',
  placement: { kind: 'biome', every: 1200, offset: 760 },
  depth: 12, drag: { base: 0, perIndex: 0 }, downforce: 0, sidePush: 0, yawPush: 0, liftScale: 1, fuelBurn: 1,
  breakBonus: { base: 0, perIndex: 0 }, warning: 'WIND GATE — HIT THE CENTRE', banner: 'GATE PERFECT',
})
