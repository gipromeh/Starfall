export class InputAdapter {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointer = { x: 0.5, y: 0.5, down: false, dx: 0, dy: 0 };
    this.firing = false;
    this.missileRequested = false;
    this.flipRequested = false;
    this.disposers = [];
    this.#bind();
  }
  #listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    this.disposers.push(() => target.removeEventListener(type, fn, options));
  }
  #bind() {
    this.#listen(window, "keydown", e => {
      this.keys.add(e.code);
      if (!e.repeat && (e.code === "Space" || e.code === "KeyF")) this.missileRequested = true;
      if (!e.repeat && e.code === "KeyV") this.flipRequested = true;
    });
    this.#listen(window, "keyup", e => this.keys.delete(e.code));
    this.#listen(window, "blur", () => {
      this.keys.clear(); this.pointer.down = false; this.firing = false;
    });
    this.#listen(this.canvas, "pointerdown", e => {
      this.canvas.setPointerCapture?.(e.pointerId);
      this.pointer.down = true;
      if (e.button === 0 && e.pointerType !== "touch") this.firing = true;
      if (e.button === 2) this.missileRequested = true;
      this.#move(e);
    });
    this.#listen(this.canvas, "pointermove", e => this.#move(e));
    this.#listen(this.canvas, "pointerup", e => {
      if (e.button === 0 && e.pointerType !== "touch") this.firing = false;
      if (e.pointerType === "touch") this.pointer.down = false;
    });
    this.#listen(this.canvas, "pointercancel", () => {
      this.pointer.down = false; this.firing = false;
    });
    this.#listen(this.canvas, "contextmenu", e => e.preventDefault());
  }
  #move(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    const y = (e.clientY - rect.top) / Math.max(1, rect.height);
    this.pointer.dx = x - this.pointer.x;
    this.pointer.dy = y - this.pointer.y;
    this.pointer.x = x;
    this.pointer.y = y;
  }
  down(code) { return this.keys.has(code); }
  consumePointerDelta() {
    const delta = { x: this.pointer.dx, y: this.pointer.dy };
    this.pointer.dx = this.pointer.dy = 0;
    return delta;
  }
  consumeMissile() {
    const requested = this.missileRequested;
    this.missileRequested = false;
    return requested;
  }
  consumeFlip() {
    const requested = this.flipRequested;
    this.flipRequested = false;
    return requested;
  }
  dispose() {
    for (const dispose of this.disposers.splice(0)) dispose();
    this.keys.clear();
  }
}
