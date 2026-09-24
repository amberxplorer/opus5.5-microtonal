/* XENOSPHERE — 3D particle pool (struct-of-arrays, swap-remove).
 * World units: the tuning wheel has radius 1 on the plane z = 1, the camera
 * sits at z = 0 looking down +z, so smaller z means closer to the viewer. */
'use strict';
(function (X) {
  class Particles {
    constructor(max) {
      this.cap = max;
      this.max = max;
      this.n = 0;
      const F = () => new Float32Array(max);
      this.x = F(); this.y = F(); this.z = F();
      this.vx = F(); this.vy = F(); this.vz = F();
      this.life = F(); this.ttl = F(); this.hue = F(); this.size = F(); this.drag = F();
    }
    setLimit(frac) { this.max = Math.max(64, Math.floor(this.cap * frac)); }
    spawn(x, y, z, vx, vy, vz, ttl, hue, size, drag = 1.2) {
      let i = this.n;
      if (i >= this.max) i = Math.floor(Math.random() * this.n); // recycle
      else this.n++;
      this.x[i] = x; this.y[i] = y; this.z[i] = z;
      this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
      this.life[i] = 0; this.ttl[i] = ttl; this.hue[i] = hue; this.size[i] = size; this.drag[i] = drag;
    }
    update(dt) {
      let i = 0;
      while (i < this.n) {
        this.life[i] += dt;
        if (this.life[i] >= this.ttl[i] || this.z[i] < 0.06) {
          const j = --this.n;
          this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.z[i] = this.z[j];
          this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
          this.life[i] = this.life[j]; this.ttl[i] = this.ttl[j]; this.hue[i] = this.hue[j];
          this.size[i] = this.size[j]; this.drag[i] = this.drag[j];
          continue;
        }
        const k = Math.exp(-this.drag[i] * dt);
        this.vx[i] *= k; this.vy[i] *= k; this.vz[i] *= k;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        this.z[i] += this.vz[i] * dt;
        i++;
      }
    }
    // proj: { cx, cy, R } in device pixels
    draw(g, proj, alpha) {
      const S = X.Sprites;
      const { cx, cy, R } = proj;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.n; i++) {
        const z = this.z[i];
        const s = R / z;
        const px = cx + this.x[i] * s, py = cy + this.y[i] * s;
        const size = this.size[i] * s;
        if (size < 0.5 || px < -size || py < -size || px > proj.w + size || py > proj.h + size) continue;
        const f = this.life[i] / this.ttl[i];
        g.globalAlpha = Math.min(1, alpha * (1 - f) * (1 - f) * Math.min(1, z * 2));
        g.drawImage(S.glow(this.hue[i]), px - size / 2, py - size / 2, size, size);
      }
      g.globalAlpha = 1;
    }
  }
  X.Particles = Particles;
})(window.XEN);
