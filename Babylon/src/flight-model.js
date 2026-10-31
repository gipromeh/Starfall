export class FlightModel {
  constructor(options={}) {
    this.velocity = new BABYLON.Vector3(0,0,0);
    this.maxSpeed = options.maxSpeed ?? 95;
    this.acceleration = options.acceleration ?? 34;
    this.lateralAcceleration = options.lateralAcceleration ?? 24;
    this.drag = options.drag ?? 0.16;
    this.boostMultiplier = options.boostMultiplier ?? 1.65;
  }
  step(dt, input, transform) {
    const forward = transform.forward.normalizeToNew();
    const right = transform.right.normalizeToNew();
    const up = transform.up.normalizeToNew();
    const boost = input.boost ? this.boostMultiplier : 1;
    this.velocity.addInPlace(forward.scale(input.throttle * this.acceleration * boost * dt));
    this.velocity.addInPlace(right.scale(input.strafe * this.lateralAcceleration * dt));
    this.velocity.addInPlace(up.scale(input.lift * this.lateralAcceleration * dt));
    this.velocity.scaleInPlace(Math.exp(-this.drag * dt));
    this.limit(this.maxSpeed * boost);
    return this.velocity;
  }
  applySteering(force, dt, maxForce=18) {
    const acceleration = new BABYLON.Vector3(force.x, force.y, force.z);
    const magnitude = acceleration.length();
    if (magnitude > maxForce) acceleration.scaleInPlace(maxForce / magnitude);
    this.velocity.addInPlace(acceleration.scale(dt));
    this.limit(this.maxSpeed);
    this.velocity.scaleInPlace(Math.exp(-this.drag * dt));
    return this.velocity;
  }
  limit(maxSpeed) {
    const speed = this.velocity.length();
    if (speed > maxSpeed) this.velocity.scaleInPlace(maxSpeed / speed);
  }
  reset() { this.velocity.set(0,0,0); }
}