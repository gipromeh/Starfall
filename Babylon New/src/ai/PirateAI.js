import * as YUKA from "yuka";

/**
 * Yuka Vehicle + Seek steering drives pirate navigation. Rapier remains the
 * authority for physical integration and contacts; vehicle state is resynced
 * from the Rapier body after every fixed simulation step.
 */
export class PirateAI {
  constructor() {
    this.manager = new YUKA.EntityManager();
    this.vehicle = new YUKA.Vehicle();
    this.target = new YUKA.GameEntity();
    this.vehicle.maxSpeed = 38;
    this.vehicle.maxForce = 22;
    this.vehicle.position.set(0, 12, -260);
    this.vehicle.steering.add(new YUKA.SeekBehavior(this.target));
    this.manager.add(this.vehicle);
    this.state = "APPROACH";
    this.stateTime = 0;
    this.fireCooldown = 1.5;
    this.side = Math.random() < 0.5 ? -1 : 1;
  }

  syncPhysics(position, velocity) {
    this.vehicle.position.set(position.x, position.y, position.z);
    this.vehicle.velocity.set(velocity.x, velocity.y, velocity.z);
  }

  update(dt, playerPosition) {
    this.stateTime += dt;
    this.fireCooldown -= dt;

    const dx = playerPosition.x - this.vehicle.position.x;
    const dy = playerPosition.y - this.vehicle.position.y;
    const dz = playerPosition.z - this.vehicle.position.z;
    const distance = Math.hypot(dx, dy, dz);

    if (this.state === "APPROACH" && distance < 165) {
      this.state = "BREAK";
      this.stateTime = 0;
      this.side = Math.random() < 0.5 ? -1 : 1;
    } else if (this.state === "BREAK" && (this.stateTime > 2.4 || distance > 330)) {
      this.state = "APPROACH";
      this.stateTime = 0;
    }

    if (this.state === "APPROACH") {
      this.target.position.set(
        playerPosition.x + this.side * 72,
        playerPosition.y + 16,
        playerPosition.z - 95
      );
      this.vehicle.maxSpeed = 38;
      this.vehicle.maxForce = 22;
    } else {
      this.target.position.set(
        playerPosition.x + this.side * 270,
        playerPosition.y + 55,
        playerPosition.z + 100
      );
      this.vehicle.maxSpeed = 46;
      this.vehicle.maxForce = 28;
    }

    this.manager.update(dt);

    const vx = this.vehicle.velocity.x;
    const vy = this.vehicle.velocity.y;
    const vz = this.vehicle.velocity.z;
    const vLength = Math.hypot(vx, vy, vz);
    const toPlayerLength = Math.max(0.001, distance);
    const dot = vLength > 0.001
      ? (vx * dx + vy * dy + vz * dz) / (vLength * toPlayerLength)
      : -1;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    const canFire = distance < 430 && angle < 0.36 &&
      this.fireCooldown <= 0 && this.state === "APPROACH";
    if (canFire) this.fireCooldown = 1.25;

    return {
      position: this.vehicle.position,
      velocity: this.vehicle.velocity,
      direction: vLength > 0.001
        ? { x: vx / vLength, y: vy / vLength, z: vz / vLength }
        : { x: dx / toPlayerLength, y: dy / toPlayerLength, z: dz / toPlayerLength },
      canFire,
      distance,
      state: this.state
    };
  }
}
