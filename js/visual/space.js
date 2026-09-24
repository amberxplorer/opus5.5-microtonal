/* XENOSPHERE — depth layers: background glow, tunnel rings, warp stars,
 * chord glyphs and theory captions flying out towards the viewer. */
'use strict';
(function (X) {
  const U = X.U, TAU = U.TAU, S = X.Sprites, W = X.Wheel;
  const SP = {};

  SP.background = function (V, g) {
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.fillRect(0, 0, V.w, V.h);
    const r = Math.max(V.w, V.h) * 0.8;
    const grd = g.createRadialGradient(V.cx, V.cy, 0, V.cx, V.cy, r);
    const a = 0.2 + 0.25 * V.energy + (V.reduced ? 0 : 0.14 * V.kick);
    grd.addColorStop(0, U.hsl(V.hue, 75, 20, a));
    grd.addColorStop(0.45, U.hsl(V.hue + 35, 70, 11, a * 0.6));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, V.w, V.h);
  };

  // Rings spawned on every beat group, flying from deep space through the wheel.
  SP.tunnel = function (V, g) {
    const u = V.u;
    g.globalCompositeOperation = 'lighter';
    for (const ring of V.rings) {
      const s = V.R / ring.z;
      const rad = s * 1.25;
      if (rad > Math.max(V.w, V.h) * 1.2) continue;
      const alpha = U.smoothstep(7, 4.5, ring.z) * U.smoothstep(0.2, 0.9, ring.z) * (0.3 + 0.25 * ring.accent);
      if (alpha < 0.01) continue;
      g.strokeStyle = U.hsl(ring.hue, 90, 60, alpha);
      g.lineWidth = Math.min(6, 1.4 / ring.z) * u;
      g.beginPath();
      g.arc(V.cx, V.cy, rad, 0, TAU);
      g.stroke();
      if (ring.n && ring.n <= 72) {
        g.beginPath();
        for (let k = 0; k < ring.n; k++) {
          const a = (k / ring.n) * TAU - Math.PI / 2 + ring.spin;
          const ca = Math.cos(a), sa = Math.sin(a);
          g.moveTo(V.cx + ca * rad, V.cy + sa * rad);
          g.lineTo(V.cx + ca * rad * 1.035, V.cy + sa * rad * 1.035);
        }
        g.stroke();
      }
    }
  };

  SP.stars = function (V, g, dt) {
    const st = V.stars, u = V.u;
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const speed = V.starSpeed;
    for (let i = 0; i < st.n; i++) {
      const z = st.z[i];
      const z2 = z + Math.max(0.02, speed * 0.045);
      const s1 = V.R / z, s2 = V.R / z2;
      const x1 = V.cx + st.x[i] * s1, y1 = V.cy + st.y[i] * s1;
      const x2 = V.cx + st.x[i] * s2, y2 = V.cy + st.y[i] * s2;
      const a = U.smoothstep(9, 5, z) * 0.75;
      g.strokeStyle = U.hsl(st.hue[i], 60, 85, a);
      g.lineWidth = Math.min(3, 0.9 / z + 0.4) * u;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x1, y1);
      g.stroke();
    }
    g.lineCap = 'butt';
  };

  function rgbText(V, g, text, x, y, off) {
    if (!V.reduced && off > 0.5) {
      const fill = g.fillStyle;
      g.fillStyle = 'rgba(255,40,120,0.55)';
      g.fillText(text, x - off, y);
      g.fillStyle = 'rgba(40,220,255,0.55)';
      g.fillText(text, x + off, y);
      g.fillStyle = fill;
    }
    g.fillText(text, x, y);
  }
  SP.rgbText = rgbText;

  // A chord glyph: the chord polygon and name, launched from the wheel plane
  // toward the camera, shedding particles from its vertices.
  SP.flyers = function (V, g) {
    const u = V.u;
    g.globalCompositeOperation = 'lighter';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of V.flyers) {
      const k = f.age / f.life;
      const alpha = Math.pow(1 - k, 1.4) * 0.9;
      const s = V.R / f.z;
      const rot = f.rot + f.spin * f.age;
      if (f.verts.length > 1) {
        g.beginPath();
        f.verts.forEach((pos, i) => {
          const a = pos * TAU - Math.PI / 2 + rot + V.wheelRot;
          const x = V.cx + Math.cos(a) * s, y = V.cy + Math.sin(a) * s;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        });
        g.closePath();
        g.fillStyle = U.hsl(f.hue, 95, 55, 0.07 * alpha);
        g.fill();
        g.strokeStyle = U.hsl(f.hue, 100, 70, 0.25 * alpha);
        g.lineWidth = Math.min(40, 9 / f.z) * u;
        g.stroke();
        g.strokeStyle = U.hsl(f.hue, 100, 82, 0.85 * alpha);
        g.lineWidth = Math.min(10, 2.2 / f.z) * u;
        g.stroke();
      }
      const fs = Math.min(V.R * 0.3 / f.z, V.h * 0.6);
      g.font = `900 ${fs}px ${W.SANS}`;
      g.globalAlpha = alpha;
      g.fillStyle = U.hsl(f.hue, 100, 80, 1);
      rgbText(V, g, f.label, V.cx, V.cy, (3 / f.z) * u);
      g.globalAlpha = 1;
    }
  };

  // Theory captions: planes of text yawed in 3D, flying past the camera.
  SP.texts = function (V, g) {
    const u = V.u;
    g.globalCompositeOperation = 'lighter';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of V.texts) {
      const s = V.R / t.z;
      const x = V.cx + t.x * s, y = V.cy + t.y * s;
      const fs = Math.min(0.085 * s * t.size, V.h * 0.3);
      if (fs < 3 * u) continue;
      const alpha = U.smoothstep(t.z0, t.z0 - 0.6, t.z) * U.smoothstep(0.22, 0.75, t.z) * t.alpha;
      if (alpha < 0.01) continue;
      const yaw = t.yaw + t.yawSpin * t.age;
      g.setTransform(Math.cos(yaw), Math.sin(yaw) * 0.22, 0, 1, x, y);
      g.font = `900 ${fs}px ${W.SANS}`;
      g.globalAlpha = alpha;
      g.fillStyle = U.hsl(t.hue, 100, 78, 1);
      rgbText(V, g, t.text, 0, 0, fs * 0.04);
      g.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
  };

  X.Space = SP;
})(window.XEN);
