export class DamageSystem {
  constructor() {
    this.hull = 100;
    this.shield = 100;
    this.heat = 0;
    this.overheated = false;
    this.missiles = 8;
    this.lastHit = -100;
    this.destroyed = false;
  }
  update(dt, now, firing) {
    this.heat = Math.max(0, this.heat - (firing && !this.overheated ? 0 : 30) * dt);
    if (this.heat >= 100) this.overheated = true;
    if (this.overheated && this.heat < 35) this.overheated = false;
    if (now - this.lastHit > 2) this.shield = Math.min(100, this.shield + 5 * dt);
  }
  fireLaser() {
    if (this.overheated || this.destroyed) return false;
    this.heat += 5.5;
    if (this.heat >= 100) this.overheated = true;
    return true;
  }
  damage(amount, now) {
    this.lastHit = now;
    const absorbed = Math.min(this.shield, amount);
    this.shield -= absorbed;
    this.hull = Math.max(0, this.hull - (amount - absorbed));
    if (this.hull <= 0) this.destroyed = true;
    return { absorbed, hullDamage: amount - absorbed, destroyed: this.destroyed };
  }
}
