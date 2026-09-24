/* XENOSPHERE — the tuning wheel and everything drawn on its plane.
 * Position around the wheel = pitch class within the period (octave, or the
 * tritave for Bohlen–Pierce). Hue = the same position, so colour is pitch. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, TAU = U.TAU, S = X.Sprites;
  const W = {};
  W.MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
  W.SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  W.ang = (V, pos) => pos * TAU - Math.PI / 2 + V.wheelRot;
  W.pt = (V, pos, r) => {
    const a = W.ang(V, pos);
    return [V.cx + Math.cos(a) * r, V.cy + Math.sin(a) * r];
  };
  W.isActive = (V, pos) => V.orbs.some((o) => Math.abs(U.circDelta(o.pos, pos)) < 0.004);

  W.ticks = function (V, g) {
    const R = V.Rp, u = V.u;
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = U.hsl(V.hue, 70, 62, 0.4);
    g.lineWidth = 1.3 * u;
    g.beginPath();
    g.arc(V.cx, V.cy, R, 0, TAU);
    g.stroke();

    const ticks = V.ticks || [];
    g.strokeStyle = 'rgba(255,255,255,0.38)';
    g.lineWidth = Math.max(1, (ticks.length > 40 ? 0.8 : 1.2) * u);
    g.beginPath();
    for (const tk of ticks) {
      const a = W.ang(V, tk.pos);
      const r0 = R * (tk.major ? 0.925 : 0.958), r1 = R * 1.035;
      g.moveTo(V.cx + Math.cos(a) * r0, V.cy + Math.sin(a) * r0);
      g.lineTo(V.cx + Math.cos(a) * r1, V.cy + Math.sin(a) * r1);
    }
    g.stroke();

    // 12-TET ghosts: where the familiar semitones would sit.
    const period = (V.tuning && V.tuning.periodCents) || 1200;
    const ghosts = Math.floor(period / 100 + 1e-9);
    g.fillStyle = 'rgba(255,255,255,0.26)';
    const rg = R * 1.058;
    for (let k = 0; k < ghosts; k++) {
      const [x, y] = W.pt(V, (k * 100) / period, rg);
      g.beginPath();
      g.arc(x, y, 1.7 * u, 0, TAU);
      g.fill();
    }

    // Labels: all of them for small tunings, naturals + chord tones otherwise.
    const fs = U.clamp(R * 0.05, 9 * u, 17 * u);
    const showAll = ticks.length <= 24;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const tk of ticks) {
      const act = W.isActive(V, tk.pos);
      if (!showAll && !tk.major && !act) continue;
      const [x, y] = W.pt(V, tk.pos, R * (act ? 1.13 : 1.115));
      g.font = `${act ? 800 : 500} ${act ? fs * 1.15 : fs}px ${W.SANS}`;
      g.fillStyle = act ? U.hsl(U.hueOfPos(tk.pos), 100, 78, 1) : 'rgba(255,255,255,0.45)';
      let label = tk.label;
      if (act) {
        const o = V.orbs.find((q) => Math.abs(U.circDelta(q.pos, tk.pos)) < 0.004);
        if (o && o.name && V.tuning && V.tuning.labelMode !== 'partial') label = o.name;
      }
      g.fillText(label, x, y);
    }
  };

  W.polygon = function (V, g) {
    const orbs = V.orbs;
    if (orbs.length < 2) return;
    const R = V.Rp, u = V.u, hue = V.chordHue;
    const pts = orbs.map((o) => W.pt(V, o.pos, R));
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = U.hsl(hue, 95, 55, 0.08 + 0.14 * V.chordFlash + (V.reduced ? 0 : 0.05 * V.kick));
    g.fill();
    g.strokeStyle = U.hsl(hue, 100, 62, 0.18);
    g.lineWidth = 8 * u;
    g.stroke();
    g.strokeStyle = U.hsl(hue, 100, 74, 0.9);
    g.lineWidth = 2 * u;
    g.stroke();

    // Interval web: every chord tone to every other.
    g.strokeStyle = U.hsl(hue + 40, 100, 72, 0.26);
    g.lineWidth = 1 * u;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 2; j < pts.length; j++) {
        if (i === 0 && j === pts.length - 1) continue;
        g.moveTo(pts[i][0], pts[i][1]);
        g.lineTo(pts[j][0], pts[j][1]);
      }
    }
    g.stroke();

    // Ratio labels from the root to each chord tone (4:5:6:7 → 5/4, 3/2, 7/4).
    const ch = V.chord;
    if (ch && ch.ratios && V.showLabels) {
      const fs = U.clamp(R * 0.036, 9 * u, 13 * u);
      g.font = `600 ${fs}px ${W.MONO}`;
      g.fillStyle = U.hsl(hue + 30, 100, 82, 0.8);
      const p0 = W.pt(V, ch.notes[0].pos, R * 0.93);
      const seen = new Set();
      for (let j = 1; j < ch.notes.length && j < 7; j++) {
        const key = Math.round(ch.notes[j].pos * 1000);
        if (seen.has(key) || Math.abs(U.circDelta(ch.notes[0].pos, ch.notes[j].pos)) < 0.003) continue;
        seen.add(key);
        const [a, b] = T.parseRatio(ch.ratios[j]);
        const [c, d] = T.parseRatio(ch.ratios[0]);
        const r = T.ratioStr([a * d, b * c]);
        const p1 = W.pt(V, ch.notes[j].pos, R * 0.93);
        g.fillText(r, U.lerp(p0[0], p1[0], 0.62), U.lerp(p0[1], p1[1], 0.62));
      }
    }
  };

  W.orbs = function (V, g) {
    const R = V.Rp, u = V.u;
    g.globalCompositeOperation = 'lighter';
    for (const o of V.orbs) {
      const [x, y] = W.pt(V, o.pos, R);
      const s = R * (0.15 + 0.12 * o.pulse);
      g.globalAlpha = 0.95;
      g.drawImage(S.glow(o.hue), x - s / 2, y - s / 2, s, s);
      g.globalAlpha = 1;
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x, y, (2.6 + 2.4 * o.pulse) * u, 0, TAU);
      g.fill();
    }
  };

  // Voice-leading arcs: how far each voice moved at the last chord change.
  W.arcs = function (V, g) {
    const R = V.Rp * 0.84, u = V.u;
    const fs = U.clamp(V.R * 0.034, 9 * u, 12 * u);
    g.globalCompositeOperation = 'lighter';
    g.font = `600 ${fs}px ${W.MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const arc of V.arcs) {
      const f = arc.age / arc.life;
      const alpha = (1 - f) * 0.95;
      const a0 = W.ang(V, arc.from), a1 = a0 + arc.delta * TAU;
      g.strokeStyle = U.hsl(arc.hue, 100, 72, alpha);
      g.lineWidth = 3 * u;
      g.beginPath();
      if (arc.delta >= 0) g.arc(V.cx, V.cy, R, a0, a1);
      else g.arc(V.cx, V.cy, R, a1, a0);
      g.stroke();
      // arrow head
      const dir = arc.delta >= 0 ? 1 : -1;
      const hx = V.cx + Math.cos(a1) * R, hy = V.cy + Math.sin(a1) * R;
      const tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir;
      const nx = Math.cos(a1), ny = Math.sin(a1);
      const L = 7 * u;
      g.fillStyle = U.hsl(arc.hue, 100, 78, alpha);
      g.beginPath();
      g.moveTo(hx + tx * L, hy + ty * L);
      g.lineTo(hx - tx * L * 0.3 + nx * L * 0.6, hy - ty * L * 0.3 + ny * L * 0.6);
      g.lineTo(hx - tx * L * 0.3 - nx * L * 0.6, hy - ty * L * 0.3 - ny * L * 0.6);
      g.fill();
      if (arc.label) {
        const am = (a0 + a1) / 2;
        g.fillText(arc.label, V.cx + Math.cos(am) * R * 0.9, V.cy + Math.sin(am) * R * 0.9);
      }
    }
  };

  W.bassRing = function (V, g) {
    const rb = V.Rp * 0.58, u = V.u;
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = U.hsl(V.hue + 200, 60, 60, 0.14);
    g.lineWidth = 1 * u;
    g.beginPath();
    g.arc(V.cx, V.cy, rb, 0, TAU);
    g.stroke();
    if (V.bassSeen) {
      const a = V.bassAng;
      const tail = 0.5 + V.bassPulse * 0.6;
      g.strokeStyle = U.hsl(V.bassHue, 100, 65, 0.25 + 0.5 * V.bassPulse);
      g.lineWidth = (2 + 4 * V.bassPulse) * u;
      g.beginPath();
      g.arc(V.cx, V.cy, rb, a - tail, a);
      g.stroke();
      const x = V.cx + Math.cos(a) * rb, y = V.cy + Math.sin(a) * rb;
      const s = V.R * (0.12 + 0.16 * V.bassPulse);
      g.drawImage(S.glow(V.bassHue), x - s / 2, y - s / 2, s, s);
    }
  };

  W.flares = function (V, g) {
    const R = V.Rp, u = V.u;
    g.globalCompositeOperation = 'lighter';
    for (const f of V.flares) {
      const k = 1 - f.age / f.life;
      const a = W.ang(V, f.pos);
      const ca = Math.cos(a), sa = Math.sin(a);
      if (f.lead) {
        g.strokeStyle = U.hsl(f.hue, 100, 75, 0.55 * k);
        g.lineWidth = 2.2 * u;
        g.beginPath();
        g.moveTo(V.cx + ca * R * 0.22, V.cy + sa * R * 0.22);
        g.lineTo(V.cx + ca * R * 1.3, V.cy + sa * R * 1.3);
        g.stroke();
      }
      const r0 = R * 1.04, r1 = R * (f.lead ? 1.3 : 1.22);
      g.strokeStyle = U.hsl(f.hue, 100, 70, 0.8 * k);
      g.lineWidth = 1.6 * u;
      g.beginPath();
      g.moveTo(V.cx + ca * r0, V.cy + sa * r0);
      g.lineTo(V.cx + ca * r1, V.cy + sa * r1);
      g.stroke();
      const s = V.R * (f.lead ? 0.2 : 0.1) * (0.5 + 0.5 * k);
      g.globalAlpha = k;
      g.drawImage(S.glow(f.hue), V.cx + ca * r1 - s / 2, V.cy + sa * r1 - s / 2, s, s);
      g.globalAlpha = 1;
    }
  };

  W.wave = function (V, g) {
    const w = V.waveData;
    if (!w) return;
    const R = V.Rp, u = V.u, N = 240;
    const step = Math.floor(w.length / N);
    const rw = R * 1.36;
    const amp = R * 0.2 * (0.7 + 0.5 * V.energy);
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const v = w[(i % N) * step] || 0;
      const a = (i / N) * TAU - Math.PI / 2 + V.t * 0.05;
      const r = rw + v * amp;
      const x = V.cx + Math.cos(a) * r, y = V.cy + Math.sin(a) * r;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    const hue = (V.hue + 160) % 360;
    g.strokeStyle = U.hsl(hue, 90, 60, 0.16);
    g.lineWidth = 5 * u;
    g.stroke();
    g.strokeStyle = U.hsl(hue, 95, 70, 0.62);
    g.lineWidth = 1.3 * u;
    g.stroke();
  };

  W.spectrum = function (V, g) {
    const sp = V.specData;
    if (!sp) return;
    const R = V.Rp, u = V.u, N = 90;
    const nyq = V.sampleRate / 2, bins = sp.length;
    const r0 = R * 1.52;
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = 2.2 * u;
    for (let k = 0; k < N; k++) {
      const f = 40 * Math.pow(12000 / 40, k / N);
      const idx = Math.min(bins - 1, Math.floor((f / nyq) * bins));
      const v = sp[idx] / 255;
      if (v < 0.05) continue;
      const len = v * v * R * 0.4;
      const a = (k / N) * TAU - Math.PI / 2 - V.t * 0.03;
      const ca = Math.cos(a), sa = Math.sin(a);
      g.strokeStyle = U.hsl(U.hueOfPos(k / N), 95, 62, 0.22 + 0.3 * v);
      g.beginPath();
      g.moveTo(V.cx + ca * r0, V.cy + sa * r0);
      g.lineTo(V.cx + ca * (r0 + len), V.cy + sa * (r0 + len));
      g.stroke();
    }
  };

  // The Lissajous figure of the chord's simplest interval, with its x and y
  // frequencies in the ratio d:n. A pure ratio closes into a still shape.
  // A tempered one slowly turns at the interval's real beat rate.
  W.lissajous = function (V, g) {
    const p = V.liss;
    if (!p) return;
    const u = V.u, size = V.Rp * 0.3, M = 360;
    const psi = V.t * (V.reduced ? 0.12 : 0.35);
    const cp = Math.cos(psi), sp = Math.sin(psi);
    g.globalCompositeOperation = 'lighter';
    g.beginPath();
    for (let i = 0; i <= M; i++) {
      const th = (i / M) * TAU;
      const x = Math.sin(p.d * th), y = Math.sin(p.n * th + V.lissPhase);
      const depth = x * sp;
      const persp = 1 / (1 + 0.28 * depth);
      const px = V.cx + x * cp * size * persp, py = V.cy + y * size * persp;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    const hue = (V.chordHue + 25) % 360;
    g.strokeStyle = U.hsl(hue, 100, 65, 0.16 + 0.12 * V.kick);
    g.lineWidth = 6 * u;
    g.stroke();
    g.strokeStyle = U.hsl(hue, 100, 80, 0.92);
    g.lineWidth = 1.5 * u;
    g.stroke();
    if (V.showLabels) {
      const fs = U.clamp(V.R * 0.036, 9 * u, 13 * u);
      g.font = `600 ${fs}px ${W.MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,0.75)';
      const pure = Math.abs(p.error) < 0.01;
      const txt = pure
        ? `${p.n}:${p.d} · pure · standing still`
        : `${p.n}:${p.d} ${U.fmtCents(p.error, 2)} · beats ${Math.abs(p.beat).toFixed(2)} Hz`;
      g.fillText(txt, V.cx, V.cy + size * 1.28);
    }
  };

  X.Wheel = W;
})(window.XEN);
