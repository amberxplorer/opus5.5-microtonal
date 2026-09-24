/* XENOSPHERE — composition toolkit shared by the sections. */
'use strict';
(function (X) {
  const U = X.U;
  const K = {};

  // Pattern strings: X accent, x normal, - soft, o ghost, . rest.
  const VEL = { X: 1, x: 0.8, '-': 0.55, o: 0.32, '.': 0 };
  K.pat = (s) => s.split('').map((ch) => VEL[ch] || 0);

  // Four one-bar break variants (16 steps). The chopper recombines their
  // quarter-bar slices, which is how jungle producers cut up breakbeats.
  K.BREAKS = [
    { k: 'X.x.......Xx....', s: '....X..o.o..X..o', h: 'x-x-x-x-x-x-x-x-' },
    { k: 'X.x.......x.....', s: '....X..o.o..X.o.', h: 'x-x-x-x-x-x-x-x-' },
    { k: 'X.........X.....', s: '....X..o....X..o', h: 'x-xox-xox-xox-xo' },
    { k: 'X..x..x...X..x..', s: '....X.oo.o..X.oX', h: 'x.x-x.x-x.x-x.x-' },
  ].map((b) => ({ k: K.pat(b.k), s: K.pat(b.s), h: K.pat(b.h) }));

  K.chopMap = function (rng, intensity) {
    const map = [];
    for (let q = 0; q < 4; q++) {
      if (q === 0) map.push([rng.pick([0, 1, 2]), 0]);
      else if (rng.next() > intensity) map.push([rng.int(0, 3), q]);
      else map.push([rng.int(0, 3), rng.int(0, 3)]);
    }
    return map;
  };
  K.breakStep = function (map, step) {
    const q = Math.floor(step / 4) % 4, i = step % 4;
    const [v, slice] = map[q];
    const b = K.BREAKS[v], idx = slice * 4 + i;
    return { k: b.k[idx], s: b.s[idx], h: b.h[idx] };
  };

  // n hits over `span` seconds, velocity and pitch interpolated.
  K.roll = function (api, t, n, span, kind, v0, v1, p0, p1, extra) {
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) : 0;
      const p = Object.assign({ pitch: U.lerp(p0 || 190, p1 || 190, f) }, extra || {});
      api.drum(t + (span * i) / n, kind, U.lerp(v0, v1, f), p);
    }
  };

  // Move a pitch by whole periods into [lo, hi).
  K.into = function (c, lo, hi, period = 1200) {
    let guard = 0;
    while (c < lo && guard++ < 50) c += period;
    while (c >= hi && guard++ < 100) c -= period;
    return c;
  };

  // Unique pitch classes of a chord (within 0.01¢).
  K.pcs = function (cents, period = 1200) {
    const out = [];
    for (const c of cents) {
      const pc = U.mod(c, period);
      if (!out.some((p) => Math.abs(p - pc) < 0.01 || Math.abs(p - pc) > period - 0.01)) out.push(pc);
    }
    return out;
  };

  /* Nearest voice leading. Every previous voice moves to the closest chord
   * tone (any octave inside [lo, hi]); while some chord tones are still
   * unused, voices prefer unused ones so the whole chord sounds. */
  K.voiceLead = function (prev, chordCents, period, lo, hi, count) {
    count = count || chordCents.length;
    const pcs = K.pcs(chordCents, period);
    if (!prev || prev.length !== count) {
      const out = [];
      let c = K.into(chordCents[0], lo, lo + period, period);
      out.push(c);
      for (let i = 1; i < count; i++) {
        const pc = pcs[i % pcs.length];
        c = c + 1 + U.mod(pc - U.mod(c + 1, period), period);
        out.push(c >= hi ? c - period * Math.ceil((c - hi + 1) / period) : c);
      }
      return out.sort((a, b) => a - b);
    }
    const used = new Set();
    const out = [];
    for (const p of prev) {
      let best = null, bd = Infinity, bi = -1;
      for (let i = 0; i < pcs.length; i++) {
        if (used.has(i) && used.size < pcs.length) continue;
        const base = p + U.mod(pcs[i] - U.mod(p, period) + period / 2, period) - period / 2;
        for (const cand of [base, base - period, base + period]) {
          if (cand < lo || cand > hi) continue;
          const d = Math.abs(cand - p);
          if (d < bd) { bd = d; best = cand; bi = i; }
        }
      }
      if (best == null) best = K.into(p, lo, hi, period);
      used.add(bi);
      out.push(best);
    }
    return out.sort((a, b) => a - b);
  };

  // All chord tones between lo and hi, ascending.
  K.pool = function (chordCents, lo, hi, period = 1200) {
    const out = [];
    for (const pc of K.pcs(chordCents, period)) {
      let c = K.into(pc, lo, lo + period, period);
      for (; c < hi; c += period) out.push(c);
    }
    return out.sort((a, b) => a - b);
  };

  K.arp = function (pool, mode, i, rng) {
    const n = pool.length;
    if (!n) return 0;
    switch (mode) {
      case 'down': return pool[n - 1 - (i % n)];
      case 'updown': {
        const m = Math.max(1, 2 * n - 2), k = i % m;
        return pool[k < n ? k : m - k];
      }
      case 'random': return rng.pick(pool);
      case 'leap': return pool[(i * 3) % n];
      case 'spiral': return pool[((i % n) * 2 + Math.floor(i / n)) % n];
      default: return pool[i % n];
    }
  };

  // A bass rhythm for one bar: [step, lengthInSteps, octaveOffset(periods)].
  K.bassRhythm = function (rng, steps, density) {
    const out = [[0, rng.pick([3, 4, 6]), 0]];
    for (let s = 3; s < steps; s++) {
      if (rng.next() < density * (s % 2 ? 0.45 : 0.8)) {
        const len = rng.pick([1, 2, 2, 3]);
        out.push([s, len, rng.chance(0.25) ? 1 : 0]);
        s += len - 1;
      }
    }
    return out;
  };

  // ------------------------------------------------ hard dance helpers
  // Kick tail pitch: the chord root moved by whole periods to sit near 55 Hz.
  K.tail = function (rootCents, period = 1200) {
    return K.into(rootCents, -2700 - period / 2, -2700 + period / 2, period);
  };

  /* Four-on-the-floor (or any list of kick steps) with the hard dance
   * furniture: tuned kick, clap backbeat, offbeat open hat, reverse bass.
   *   o.kicks   steps with a kick (default every 4th step)
   *   o.offs    steps with offbeat hat + reverse bass (default kick+2)
   *   o.claps   steps with a clap
   *   o.tail    cents of the kick tail;  o.rev cents of the reverse bass
   *   o.kick    'hardkick' | 'kick';  o.kickP extra kick params */
  K.hardDrums = function (api, step, t, o) {
    const kicks = o.kicks || [0, 4, 8, 12];
    const offs = o.offs || kicks.map((k) => k + 2);
    if (!o.noKick && kicks.includes(step)) {
      const p = Object.assign({ tail: X.T.hz(o.tail) }, o.kickP || {});
      api.drum(t, o.kick || 'hardkick', o.kickVel || 1, p);
      api.duck(t, o.duck != null ? o.duck : 0.6, 0.11);
    }
    if (o.claps && o.claps.includes(step)) api.drum(t, 'clap', 0.85, { tone: 1300 });
    if (offs.includes(step)) {
      if (o.openHat !== false) api.drum(t, 'hat', 0.75, { open: true, decay: 0.16 });
      if (o.rev != null && !o.noKick) {
        const len = o.revLen || 2;
        api.play(t, 'revbass', o.rev, api.stepDur * len * 0.98, o.revVel || 0.9, { layer: 'bass', drive: o.revDrive });
      }
    }
    if (o.hats && step % 2 === 1) api.drum(t, 'hat', 0.35 * o.hats, { pan: step % 4 === 1 ? -0.3 : 0.3 });
  };

  // Snare build-up: quarters → eighths → sixteenths → thirty-seconds.
  K.build = function (api, t, i, total, o = {}) {
    const f = i / total;
    const vel = 0.35 + 0.6 * f;
    const pitch = 170 + 280 * f;
    const every = f < 0.25 ? 4 : f < 0.5 ? 2 : 1;
    if (f >= 0.75) {
      api.drum(t, 'snare', vel, { pitch, decay: 0.09 });
      api.drum(t + api.stepDur / 2, 'snare', vel, { pitch: pitch * 1.03, decay: 0.08 });
    } else if (i % every === 0) {
      api.drum(t, 'snare', vel, { pitch, decay: 0.12 });
    }
    if (o.kick && i % 4 === 0 && f < 0.75) api.drum(t, 'kick', 0.6 + 0.3 * f, { decay: 0.25 });
  };

  /* Rhythm generator for any meter: an onset on every group start, extra
   * onsets inside groups with probability `density`. Returns [{step,len}]. */
  K.rhythm = function (rng, steps, groups, density) {
    const starts = new Set();
    let acc = 0;
    for (const g of groups) { starts.add(acc); acc += g; }
    const on = [];
    for (let s = 0; s < steps; s++) {
      if (starts.has(s) || (s % 2 === 0 && rng.next() < density) || (s % 2 === 1 && rng.next() < density * 0.35)) on.push(s);
    }
    return on.map((s, i) => ({ step: s, len: Math.min(4, (on[i + 1] != null ? on[i + 1] : steps) - s) }));
  };

  /* A hook: one rhythm plus a contour of pool indices. Re-applied to every
   * chord it stays recognisable while the harmony (and tuning) moves. */
  K.hook = function (rng, steps, groups, density, span = 6) {
    const rhythm = K.rhythm(rng, steps, groups, density);
    let idx = rng.int(1, 3);
    const notes = rhythm.map((r, i) => {
      if (i > 0) idx = U.clamp(idx + rng.pick([-2, -1, -1, 1, 1, 2, 0, 3]), 0, span);
      return { step: r.step, len: r.len, idx };
    });
    if (notes.length > 1) notes[notes.length - 1].idx = rng.pick([0, 2, 4]);
    return notes;
  };
  K.hookAt = function (hook, step) {
    for (const n of hook) if (n.step === step) return n;
    return null;
  };

  X.Kit = K;
})(window.XEN);
