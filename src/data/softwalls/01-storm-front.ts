import { defineSoftWall } from '../define'
export default defineSoftWall({
  id: 'storm-front', name: 'Storm Front', visual: 'storm',
  placement: { kind: 'fixed', distances: [500, 1150, 2050, 3200, 4700, 6600, 9000, 12000] },
  depth: 60, drag: { base: 9, perIndex: 3.5 }, downforce: 2.2, sidePush: 0, yawPush: 0, liftScale: 1, fuelBurn: 1,
  breakBonus: { base: 120, perIndex: 60 }, warning: 'STORM AHEAD — BOOST THROUGH', banner: 'STORM BROKEN',
})
