import { Vector3, Quaternion } from "@babylonjs/core";

/**
 * STARFALL flight model ported from the reference HTML:
 * throttle 0..1, forward target speed 150 m/s, lateral damping and inertia.
 * Input mapping: W/S throttle, A/D strafe, R/C vertical, Shift boost, X brake.
 */
export class FlightModel {
  constructor() {
    this.velocity = new Vector3(0, 0, 0);
    this.orientation = Quaternion.Identity();
    this.throttle = 0.25;
    this.boost = 0;
    this.fuel = 100;
    this.angular = new Vector3();
    this.sensitivity = 1;
    this.inertia = 1;
    this.speedMultiplier = 1;
    this.shipSpeed = 1.15;
    this.damping = 3.2;
    this.acceleration = 0.55;
    this.boostDrain = 22;
    this.boostRegen = 9;
  }

  update(dt, input) {
    const k = code => input.down(code) ? 1 : 0;
    const boostHeld = (k("ShiftLeft") || k("ShiftRight")) && this.fuel > 0;
    this.boost += ((boostHeld ? 1 : 0) - this.boost) * Math.min(1, 4 * dt);
    this.fuel = boostHeld
      ? Math.max(0, this.fuel - this.boostDrain * dt)
      : Math.min(100, this.fuel + ((k("ShiftLeft") || k("ShiftRight")) ? 0 : this.boostRegen) * dt);

    this.throttle = Math.max(0, Math.min(1,
      this.throttle + ((k("KeyW") - k("KeyS")) * 0.55 - (k("KeyX") * 2.5)) * dt
    ));

    // The source game aims by mouse offset from screen center.
    const aimX = Math.max(-1, Math.min(1, input.pointer.x * 2 - 1));
    const aimY = Math.max(-1, Math.min(1, input.pointer.y * 2 - 1));
    const dead = 0.07;
    const curve = value => {
      const a = Math.abs(value);
      return a <= dead ? 0 : Math.sign(value) * Math.pow((a - dead) / (1 - dead), 1.6);
    };
    const yawTarget = -curve(aimX) * 2.2 * this.sensitivity;
    const pitchTarget = -curve(aimY) * 1.8 * this.sensitivity;
    const smooth = Math.min(1, 10 * dt);
    this.angular.y += (yawTarget - this.angular.y) * smooth;
    this.angular.x += (pitchTarget - this.angular.x) * smooth;
    this.angular.z += (((k("KeyQ") - k("KeyZ")) * 1.8) - this.angular.z) * smooth;

    const yaw = Quaternion.RotationAxis(Vector3.Up(), this.angular.y * dt);
    const pitch = Quaternion.RotationAxis(Vector3.Right(), this.angular.x * dt);
    const roll = Quaternion.RotationAxis(Vector3.Forward(), this.angular.z * dt);
    this.orientation = this.orientation.multiply(yaw).multiply(pitch).multiply(roll).normalize();

    const forward = Vector3.Forward().negate().applyRotationQuaternion(this.orientation);
    const right = Vector3.Right().applyRotationQuaternion(this.orientation);
    const up = Vector3.Up().applyRotationQuaternion(this.orientation);
    const strafe = right.scale(k("KeyD") - k("KeyA"))
      .addInPlace(up.scale(k("KeyR") - k("KeyC")));
    this.velocity.addInPlace(strafe.scale(70 * (this.damping / 1.3) * this.shipSpeed * dt));

    const forwardSpeed = Vector3.Dot(this.velocity, forward);
    const lateral = this.velocity.subtract(forward.scale(forwardSpeed));
    const lateralDamping = Math.exp(-this.damping * (k("KeyX") ? 2 : 1) * dt);
    lateral.scaleInPlace(lateralDamping);
    const targetSpeed = 150 * this.shipSpeed * Math.max(this.throttle, this.boost * 0.8) * (1 + 0.9 * this.boost);
    const response = Math.min(1, this.damping * 0.55 * (k("KeyX") ? 2.5 : 1) * dt);
    const nextForwardSpeed = forwardSpeed + (targetSpeed - forwardSpeed) * response;
    this.velocity = lateral.add(forward.scale(nextForwardSpeed));

    if (input.consumeFlip()) {
      this.orientation = this.orientation.multiply(Quaternion.RotationAxis(Vector3.Up(), Math.PI)).normalize();
    }
    return { velocity: this.velocity, orientation: this.orientation, forward, speed: this.velocity.length() };
  }
}
