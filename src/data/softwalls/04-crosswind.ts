import { defineSoftWall } from '../define'
export default defineSoftWall({
  id: 'crosswind', name: 'Crosswind Corridor', visual: 'crosswind',
  placement: { kind: 'biome', every: 400, offset: 200 },
  depth: 300, drag: { base: 0, perIndex: 0 }, downforce: 0, sidePush: 3, yawPush: 0.35, liftScale: 1, fuelBurn: 1,
  breakBonus: { base: 80, perIndex: 60 }, warning: 'CROSSWIND — STEER INTO IT', banner: 'CROSSWIND BEATEN',
})
