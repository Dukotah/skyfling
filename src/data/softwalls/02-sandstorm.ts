import { defineSoftWall } from '../define'
export default defineSoftWall({
  id: 'sandstorm', name: 'Sandstorm', visual: 'sandstorm',
  placement: { kind: 'biome', every: 600, offset: 380 },
  depth: 120, drag: { base: 4.5, perIndex: 1.7 }, downforce: 0, sidePush: 6, yawPush: 0, liftScale: 1, fuelBurn: 1,
  breakBonus: { base: 80, perIndex: 60 }, warning: 'SANDSTORM — HOLD YOUR LINE', banner: 'SANDSTORM CROSSED',
})
