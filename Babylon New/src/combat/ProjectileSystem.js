import { MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";

export class ProjectileSystem {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.items = [];
    this.laserMaterial = new StandardMaterial("laser-material", scene);
    this.laserMaterial.emissiveColor = new Color3(0.25, 0.95, 1);
    this.enemyMaterial = new StandardMaterial("enemy-laser-material", scene);
    this.enemyMaterial.emissiveColor = new Color3(1, 0.18, 0.28);
    this.missileMaterial = new StandardMaterial("missile-material", scene);
    this.missileMaterial.emissiveColor = new Color3(1, 0.55, 0.12);
  }
  fire(origin, direction, { enemy = false, speed = 420, damage = 20, life = 1.3, missile = false, target = null } = {}) {
    const mesh = MeshBuilder.CreateBox("projectile", { width: missile ? 0.34 : 0.12, height: missile ? 0.34 : 0.12, depth: missile ? 2.1 : 3.2 }, this.scene);
    mesh.material = missile ? this.missileMaterial : (enemy ? this.enemyMaterial : this.laserMaterial);
    mesh.position.copyFrom(origin);
    mesh.lookAt(origin.clone().addInPlace(direction));
    this.items.push({ mesh, velocity: direction.scale(speed), speed, damage, life, enemy, missile, target, previous: origin.clone() });
  }
  update(dt, onHit) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.previous.copyFrom(p.mesh.position);
      if (p.missile && p.target && p.target.isEnabled()) {
        const desired = p.target.position.subtract(p.mesh.position).normalize();
        const current = p.velocity.clone().normalize();
        const steered = Vector3.Lerp(current, desired, Math.min(1, 1.7 * dt)).normalize();
        p.velocity = steered.scale(p.speed);
        p.mesh.lookAt(p.mesh.position.add(steered));
      }
      p.mesh.position.addInPlace(p.velocity.scale(dt));
            p.life -= dt;

      const delta = p.mesh.position.subtract(p.previous);
      const length = delta.length();
      if (length > 0.001) {
        const ray = new this.physicsWorld.RAPIER.Ray(p.previous, delta.normalize());
        const hit = this.physicsWorld.world.castRay(ray, length, true);
        if (hit) {
          const collider = hit.collider;
          const tag = this.physicsWorld.tags.get(collider.handle);
          if (tag && ((p.enemy && tag === "player") || (!p.enemy && tag === "pirate"))) {
            const point = p.previous.add(delta.normalize().scale(hit.toi));
            onHit({ projectile: p, tag, point });
            p.life = 0;
          }
        }
      }
      if (p.life <= 0) {
        p.mesh.dispose();
        this.items.splice(i, 1);
      }
    }
  }
  dispose() {
    for (const p of this.items) p.mesh.dispose();
    this.items.length = 0;
    this.laserMaterial.dispose(); this.enemyMaterial.dispose(); this.missileMaterial.dispose();
  }
}
