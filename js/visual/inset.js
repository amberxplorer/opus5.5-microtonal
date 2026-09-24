/* XENOSPHERE — bottom-right theory inset.
 *   errors   patent val + how far each tuned interval is from just
 *   lattice  5-limit lattice (fifths → right, major thirds → up) with the
 *            comma pump's path drifting left one syntonic comma per lap
 *   partials the harmonic series: deviation of each partial from 12-TET */
'use strict';
(function (X) {
  const U = X.U, T = X.T, W = X.Wheel, TAU = U.TAU;
  const I = {};

  function panel(V, g, x, y, w, h, title) {
    const u = V.u;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(0,0,0,0.62)';
    g.fillRect(x, y, w, h);
    g.strokeStyle = U.hsl(V.hue, 80, 65, 0.45);
    g.lineWidth = 1 * u;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.fillStyle = U.hsl(V.hue, 90, 75, 0.95);
    g.font = `700 ${11 * u}px ${W.MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(title, x + 10 * u, y + 8 * u);
  }

  I.draw = function (V, g) {
    if (!V.showInset || !V.tuning) return;
    const u = V.u;
    const w = 318 * u, h = 212 * u;
    const x = V.w - w - 18 * u, y = V.h - h - 18 * u;
    const mode = (V.section && V.section.inset) || 'errors';
    if (mode === 'lattice' && V.tuning.kind === 'ji') I.lattice(V, g, x, y, w, h);
    else if (mode === 'partials') I.partials(V, g, x, y, w, h);
    else I.errors(V, g, x, y, w, h);
  };

  I.errors = function (V, g, x, y, w, h) {
    const tu = V.tuning, u = V.u;
    const title = tu.kind === 'ed'
      ? `${tu.name} · patent val ${tu.valString()}`
      : `${tu.name} · every interval exact`;
    panel(V, g, x, y, w, h, title);
    const rows = (tu.refRatios || []).slice(0, 8);
    const top = y + 30 * u, rh = Math.min(21 * u, (h - 40 * u) / Math.max(1, rows.length));
    const barX = x + 168 * u, barW = 96 * u;
    g.font = `500 ${11 * u}px ${W.MONO}`;
    g.textBaseline = 'middle';
    rows.forEach((r, i) => {
      const a = tu.approx(r);
      const cy = top + rh * (i + 0.5);
      g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillText(a.ratio, x + 10 * u, cy);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      const stepTxt = a.steps != null ? `${a.steps}\\${tu.n}` : 'exact';
      g.fillText(stepTxt, x + 64 * u, cy);
      g.fillText(`${a.cents.toFixed(1)}¢`, x + 112 * u, cy);
      // error bar, full scale ±30¢
      const e = U.clamp(a.error / 30, -1, 1);
      const mid = barX + barW / 2;
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(barX, cy - 0.5 * u, barW, 1 * u);
      g.fillRect(mid - 0.5 * u, cy - 6 * u, 1 * u, 12 * u);
      const ae = Math.abs(a.error);
      g.fillStyle = ae < 3 ? 'hsl(165,95%,60%)' : ae < 10 ? 'hsl(50,100%,60%)' : 'hsl(320,100%,65%)';
      const bw = e * barW / 2;
      g.fillRect(Math.min(mid, mid + bw), cy - 4 * u, Math.max(1.5 * u, Math.abs(bw)), 8 * u);
      g.textAlign = 'right';
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText(U.fmtCents(a.error, 1), x + w - 8 * u, cy);
    });
  };

  // Tenney-style lattice: x = e3 + e5/2, y = −e5 (triangular geometry).
  I.lattice = function (V, g, x, y, w, h) {
    const u = V.u, L = V.lattice;
    panel(V, g, x, y, w, h, `5-limit lattice · drift ${U.fmtCents(L.drift || 0, 1)}`);
    g.save();
    g.beginPath();
    g.rect(x + 1, y + 24 * u, w - 2, h - 25 * u);
    g.clip();
    const sx = 44 * u, sy = 36 * u;
    const ox = x + w / 2, oy = y + h / 2 + 12 * u;
    const pos = (e3, e5) => [ox + (e3 + e5 / 2 - L.cx) * sx, oy - (e5 - L.cy) * sy];
    const c3 = Math.round(L.cx), c5 = Math.round(L.cy);
    // edges
    g.strokeStyle = 'rgba(255,255,255,0.13)';
    g.lineWidth = 1 * u;
    g.beginPath();
    for (let e5 = c5 - 3; e5 <= c5 + 3; e5++) {
      for (let e3 = c3 - 6; e3 <= c3 + 6; e3++) {
        const [px, py] = pos(e3, e5);
        for (const [d3, d5] of [[1, 0], [0, 1], [-1, 1]]) {
          const [qx, qy] = pos(e3 + d3, e5 + d5);
          g.moveTo(px, py);
          g.lineTo(qx, qy);
        }
      }
    }
    g.stroke();
    // active chord triangle
    if (L.tri) {
      g.globalCompositeOperation = 'lighter';
      g.beginPath();
      L.tri.forEach(([a, b], i) => { const [px, py] = pos(a, b); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.closePath();
      g.fillStyle = U.hsl(V.chordHue, 100, 60, 0.35);
      g.fill();
      g.strokeStyle = U.hsl(V.chordHue, 100, 75, 0.9);
      g.lineWidth = 2 * u;
      g.stroke();
    }
    // root path
    if (L.path.length > 1) {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = U.hsl(30, 100, 65, 0.8);
      g.lineWidth = 2.2 * u;
      g.beginPath();
      L.path.forEach(([a, b], i) => { const [px, py] = pos(a, b); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.stroke();
    }
    // nodes + names
    g.globalCompositeOperation = 'source-over';
    g.font = `600 ${10.5 * u}px ${W.MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const active = new Set((L.tri || []).map(([a, b]) => a + ',' + b));
    for (let e5 = c5 - 2; e5 <= c5 + 2; e5++) {
      for (let e3 = c3 - 6; e3 <= c3 + 6; e3++) {
        const [px, py] = pos(e3, e5);
        if (px < x - 20 * u || px > x + w + 20 * u) continue;
        const on = active.has(e3 + ',' + e5);
        g.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.arc(px, py, (on ? 3.4 : 2) * u, 0, TAU);
        g.fill();
        g.fillStyle = on ? U.hsl(V.chordHue, 100, 85, 1) : 'rgba(255,255,255,0.4)';
        g.fillText(T.jiName([0, e3, e5, 0, 0, 0]), px, py - 9 * u);
      }
    }
    g.restore();
    g.font = `500 ${10 * u}px ${W.MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText('→ 3/2   ↗ 5/4   comma = (−4, +1)', x + 10 * u, y + h - 6 * u);
  };

  I.partials = function (V, g, x, y, w, h) {
    const u = V.u;
    panel(V, g, x, y, w, h, 'harmonic series · deviation from 12-TET');
    const N = 24, left = x + 14 * u, right = x + w - 12 * u;
    const mid = y + h / 2 + 8 * u, amp = (h / 2 - 34 * u);
    const bw = (right - left) / N;
    g.strokeStyle = 'rgba(255,255,255,0.2)';
    g.lineWidth = 1 * u;
    g.beginPath();
    g.moveTo(left, mid);
    g.lineTo(right, mid);
    g.stroke();
    g.font = `500 ${9 * u}px ${W.MONO}`;
    g.textAlign = 'center';
    const active = V.partialsActive || new Set();
    for (let k = 1; k <= N; k++) {
      const c = U.mod(1200 * Math.log2(k), 1200);
      const dev = c - Math.round(c / 100) * 100;
      const bx = left + (k - 0.5) * bw;
      const bh = (dev / 50) * amp;
      const on = active.has(k);
      g.fillStyle = on ? U.hsl(U.hueOfPos(c / 1200), 100, 65, 0.95) : 'rgba(255,255,255,0.18)';
      g.fillRect(bx - bw * 0.32, Math.min(mid, mid - bh), bw * 0.64, Math.max(1 * u, Math.abs(bh)));
      if (k % 2 === 1 || k <= 4) {
        g.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.4)';
        g.textBaseline = 'top';
        g.fillText(String(k), bx, y + h - 16 * u);
      }
    }
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillText('+50¢', x + 8 * u, y + 26 * u);
    g.textBaseline = 'bottom';
    g.fillText('−50¢', x + 8 * u, y + h - 22 * u);
  };

  X.Inset = I;
})(window.XEN);
