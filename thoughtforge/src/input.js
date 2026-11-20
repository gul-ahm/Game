const INK_GAP = 4;

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.stroke = null;
    this.done = [];
    this.look = { dx: 0, dy: 0, zoom: 0 };
    this.orbit = false;

    addEventListener('keydown', e => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.stroke = null;
      this.orbit = false;
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.stroke = [{ x: e.clientX, y: e.clientY }];
      if (e.button === 2) this.orbit = true;
    });
    addEventListener('mousemove', e => {
      if (this.orbit) {
        this.look.dx += e.movementX;
        this.look.dy += e.movementY;
      }
      const last = this.stroke?.at(-1);
      if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) >= INK_GAP) {
        this.stroke.push({ x: e.clientX, y: e.clientY });
      }
    });
    addEventListener('mouseup', e => {
      if (e.button === 0 && this.stroke) {
        this.done.push(this.stroke);
        this.stroke = null;
      }
      if (e.button === 2) this.orbit = false;
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.look.zoom += e.deltaY;
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  axis() {
    const k = this.keys;
    return {
      x: (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0),
      y: (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0),
    };
  }

  hit(code) {
    return this.pressed.has(code);
  }

  takeStroke() {
    return this.done.shift();
  }

  takeLook() {
    const look = { ...this.look };
    this.look = { dx: 0, dy: 0, zoom: 0 };
    return look;
  }

  endFrame() {
    this.pressed.clear();
  }
}
