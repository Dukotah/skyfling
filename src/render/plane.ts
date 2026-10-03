import * as THREE from 'three'

/**
 * Builds the stylized low-poly hero plane (tier-0-ish paper dart) in the
 * Skyfling palette. Returns a Group whose local +X is the nose (forward),
 * so the caller orients it by the flight yaw/pitch. Real pack models and the
 * full evolve roster (src/data/planes.ts) arrive in Phase 2.5.
 */
export function buildPlane(): THREE.Group {
  const g = new THREE.Group()
  const coral = new THREE.MeshStandardMaterial({ color: 0xff6b4a, roughness: 0.45, metalness: 0.1, flatShading: true })
  const butter = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.4, metalness: 0.15, flatShading: true })
  const navy = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.3, metalness: 0.3, flatShading: true })
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fdfff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.55 })

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 4.2, 10), coral)
  body.rotation.z = Math.PI / 2
  g.add(body)

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 10), coral)
  nose.rotation.z = -Math.PI / 2
  nose.position.x = 2.5
  g.add(nose)

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass)
  canopy.scale.set(1.4, 0.7, 0.9)
  canopy.position.set(0.7, 0.42, 0)
  g.add(canopy)

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 6.4), butter)
  wing.position.set(0.1, -0.05, 0)
  g.add(wing)

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 2.4), butter)
  tail.position.set(-1.9, 0.05, 0)
  g.add(tail)

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.12), coral)
  fin.position.set(-2.0, 0.55, 0)
  g.add(fin)

  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), navy)
  hub.rotation.z = -Math.PI / 2
  hub.position.x = 3.1
  g.add(hub)

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  g.scale.setScalar(1.6)
  return g
}
