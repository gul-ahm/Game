import * as THREE from 'three';

const dummy = new THREE.Object3D();

export class BulletPool {
  constructor(scene, max, color, size) {
    const geo = new THREE.SphereGeometry(size, 8, 6).scale(1, 1, 2.6);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5) });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max;
    this.items = [];
    scene.add(this.mesh);
  }

  spawn(x, z, vx, vz, damage, life, pierce = 0) {
    if (this.items.length >= this.max) return;
    this.items.push({ x, z, vx, vz, damage, life, pierce, hit: null, dead: false });
  }

  clear() {
    this.items.length = 0;
    this.mesh.count = 0;
  }

  update(dt) {
    let n = 0;
    for (const b of this.items) {
      b.life -= dt;
      if (b.dead || b.life <= 0) continue;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      dummy.position.set(b.x, 1, b.z);
      dummy.rotation.y = Math.atan2(b.vx, b.vz);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(n, dummy.matrix);
      this.items[n++] = b;
    }
    this.items.length = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
