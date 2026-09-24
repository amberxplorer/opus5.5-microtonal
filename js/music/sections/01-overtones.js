/* I · OVERTONE BLOOM — the harmonic series of A1 (55 Hz). No tuning system
 * at all: every pitch is an integer multiple of the fundamental. Partials
 * fade in one by one until they fuse into a single bright tone, then the
 * hardstyle kick arrives with its tail tuned to partial 1. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit, S = X.S;
  const F0 = -2700; // A1 = 55 Hz, in cents from C4
  const pc = (k) => F0 + 1200 * Math.log2(k);
  // [bar, partials entering]
  const ENTRY = [[0, [1, 2, 3, 4]], [1, [5, 6, 8]], [2, [7, 10, 12]], [3, [9, 11, 14, 16]],
    [4, [13, 15, 18, 20]], [5, [17, 19, 21, 22, 23, 24]]];

  function partialFact(k) {
    const c = 1200 * Math.log2(k);
    const inOct = U.mod(c, 1200);
    const dev = inOct - Math.round(inOct / 100) * 100;
    return `PARTIAL ${k} · ${inOct.toFixed(1)}¢ · ${U.fmtCents(dev)} VS 12-TET`;
  }

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 1, id: 'overtones', title: 'OVERTONE BLOOM', subtitle: 'the harmonic series is the only tuning',
    tuningLabel: 'harmonic series of A1 = 55 Hz', bars: 8, bpm: 150,
    meter: { steps: 16, groups: [4, 4, 4, 4], label: '4/4' }, inset: 'partials', hue: 45, impact: false,
    energyAt: (bar) => 0.12 + bar * 0.11,

    init(api, t) {
      const tuning = new T.Just({
        id: 'hs', name: 'Harmonic series', subtitle: 'partials of A1 = 55 Hz', baseCents: F0,
        labelMode: 'partial', stat: 'integer multiples of 55 Hz · nothing tempered',
      });
      const ticks = [];
      for (let k = 1; k <= 23; k += 2) ticks.push({ cents: pc(k), label: String(k), major: k === 1 });
      tuning.setTicks(ticks);
      api.setTuning(t, tuning);
      api.text(t + 0.2, 'NO SCALE. NO TEMPERAMENT. JUST INTEGERS.', { size: 1.1 });
      const drone = new S.PartialDrone(api.E, 55, 24);
      return { tuning, drone, active: [], walk: 10, hook: K.hook(api.rng, 16, [4, 4, 4, 4], 0.5, 8) };
    },

    onBar(st, bar, t, api) {
      const entry = ENTRY.find((e) => e[0] === bar);
      if (entry) {
        entry[1].forEach((k, i) => {
          st.drone.set(k, t + i * api.stepDur, 0.1 / Math.pow(k, 0.72), 0.5);
          st.active.push(k);
        });
        st.active.sort((a, b) => a - b);
        const top = st.active[st.active.length - 1];
        api.chord(t, C.raw(st.tuning, {
          notes: st.active.map((k) => ({ cents: pc(k), name: String(k) })),
          rootName: 'A', sym: `1–${top}`, quality: 'harmonic series',
          chordStr: st.active.join(':'), ratios: st.active.map((k) => `${k}/1`),
          relStr: `f = 55 Hz × {${st.active.join(', ')}}`,
          fn: bar < 5 ? 'partials fuse into one tone: timbre is a chord' : 'otonal: every note is a multiple of 55 Hz',
        }));
        const notable = entry[1].filter((k) => [5, 7, 11, 13].includes(k));
        notable.forEach((k, i) => api.text(t + (i + 1) * api.beatDur, partialFact(k)));
        api.stat(t, `partials 1–${top} sounding`);
      }
      if (bar === 4) api.text(t, 'KICK TAIL = PARTIAL 1 = 55 Hz', { size: 1.2 });
      if (bar === 6) api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 0.9);
    },

    onStep(st, bar, step, t, api) {
      const rng = api.rng;
      // Bell arpeggio walking the harmonic-series scale (partials 8–24).
      const dense = bar >= 4;
      if (bar >= 1 && (dense || step % 2 === 0) && !(bar === 7 && step >= 14)) {
        const avail = st.active.filter((k) => k >= 8);
        if (avail.length) {
          st.walk = U.clamp(st.walk + rng.pick([-3, -2, -1, 1, 2, 3]), 8, 24);
          let k = avail.reduce((a, b) => (Math.abs(b - st.walk) < Math.abs(a - st.walk) ? b : a));
          api.play(t, 'bell', pc(k), api.stepDur * 2, 0.35 + 0.25 * (step % 4 === 0), {
            ratio: 2, index: 1.1, decay: 0.9, pan: rng.range(-0.6, 0.6),
          });
        }
      }
      // Hook on the saw lead from bar 4, pitched on the partials.
      if (bar >= 4 && bar < 7) {
        const h = K.hookAt(st.hook, step);
        if (h) {
          const pool = [8, 9, 10, 11, 12, 13, 14, 16, 18].filter((k) => st.active.includes(k));
          const k = pool[Math.min(h.idx, pool.length - 1)];
          api.play(t, 'lead', pc(k), api.stepDur * h.len * 0.9, 0.55, { cut: 3200, vib: 0.004 });
        }
      }
      // Drums arrive at bar 4; bars 6–7 are the build.
      if (bar >= 4 && bar < 6) {
        K.hardDrums(api, step, t, { tail: pc(1), claps: bar === 5 ? [4, 12] : null, hats: 0.5 });
      }
      if (bar >= 6) {
        const i = (bar - 6) * 16 + step;
        if (i < 30) K.build(api, t, i, 32, { kick: true });
        if (step % 2 === 1 && i < 30) api.drum(t, 'hat', 0.3);
      }
    },

    onExit(st, t) { st.drone.stop(t, 2.2); },
  });
})(window.XEN);
