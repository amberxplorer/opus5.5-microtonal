/* IV · THE COMMA PUMP — euphoric hardstyle in pure 5-limit just intonation.
 * I → vi → ii → V → I with every common tone held perfectly still:
 *   C (1/1) → Am (A = 5/3) → Dm (D = 10/9) → G (G = 40/27) → C (80/81).
 * The progression returns a syntonic comma (81/80 = 21.51¢) flat, every lap.
 * Four laps sink 86¢. Then three pure major thirds (125/64) sink another
 * lesser diesis (41.06¢). The kick tail and reverse bass drift with it. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit;
  // 5-limit monzo with the power of two chosen so the pitch sits near C4.
  const M = (e3, e5) => {
    const m = [0, e3, e5, 0, 0, 0];
    m[0] = -Math.floor((T.monzoCents(m) + 600) / 1200);
    return m;
  };
  // One lap of the pump: [root monzo, quality, roman, what it holds]
  const LAP = [
    [M(0, 0), 'maj', 'I', 'tonic'],
    [M(-1, 1), 'min', 'vi', 'holds C and E'],
    [M(-2, 1), 'min', 'ii', 'holds A'],
    [M(-3, 1), 'maj', 'V', 'holds D'],
  ];
  const COMMA = T.ratioCents('81/80');
  const DIESIS = T.ratioCents('128/125');
  const PENTA = { maj: ['1/1', '9/8', '5/4', '3/2', '5/3'], min: ['1/1', '6/5', '4/3', '3/2', '9/5'] };

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 4, id: 'commapump', title: 'THE COMMA PUMP', subtitle: 'pure ratios that refuse to come home',
    tuningLabel: '5-limit just intonation', bars: 18, bpm: 150,
    meter: { steps: 16, groups: [4, 4, 4, 4], label: '4/4' }, inset: 'lattice', hue: 30,
    energyAt: (bar) => (bar < 4 ? 0.3 : bar < 8 ? 0.35 + (bar - 4) * 0.12 : 1),

    init(api, t) {
      const tu = new T.Just({
        id: 'ji5', name: '5-limit JI', subtitle: 'pure 3/2 and 5/4, no tempering',
        stat: `pure 3/2 & 5/4 · syntonic comma 81/80 = ${COMMA.toFixed(2)}¢`,
        refRatios: ['3/2', '5/4', '6/5', '81/80', '128/125'],
      });
      api.bassTimbre(t, { saw: 0.3, sub: 0.9, cutoff: 380, env: 3, q: 3, drive: 0.3, detune: 6, lfoDepth: 60, level: 0.45 });
      const rng = api.rng;
      return { tu, voicing: null, hook: K.hook(rng, 16, [4, 4, 4, 4], 0.6, 7), lap: -1, chord: null };
    },

    chordAt(st, bar, half) {
      if (bar < 16) {
        const lap = Math.floor(bar / 4);
        const [m, q, roman, holds] = LAP[bar % 4];
        const root = M(m[1] - 4 * lap, m[2] + lap);
        const next = bar % 4 === 3 ? ' → next C = 80/81 lower' : '';
        return { root, q, lap, drift: -lap * COMMA, fn: `${roman} · ${holds}${next}` };
      }
      // Diesis pump: C → E → G♯ → B♯ in pure major thirds (half a bar each).
      const k = (bar - 16) * 2 + half;
      const root = M(-16, 4 + k);
      const names = ['I', 'III (+5/4)', '♯V (+25/16)', '♯VII (+125/64)'];
      return { root, q: 'maj', lap: 4, drift: -4 * COMMA - (k === 3 ? DIESIS : 0),
        fn: `${names[k]}${k === 3 ? ' · a lesser diesis below the old C' : ''}` };
    },

    enterChord(st, spec, t, api) {
      const tu = st.tu;
      const ch = C.make(tu, spec.root, spec.q, { fn: spec.fn });
      if (spec.lap !== st.lap || spec.newTicks) {
        st.lap = spec.lap;
        const ticks = [];
        const add = (m, major) => {
          const cents = T.monzoCents(m);
          if (!ticks.some((x) => Math.abs(U.mod(x.cents - cents + 600, 1200) - 600) < 0.5)) {
            ticks.push({ cents, label: tu.nameOfMonzo(m), major });
          }
        };
        for (let b = 0; b < 4; b++) {
          const sp = this.chordAt(st, Math.min(spec.lap * 4 + b, 15), 0);
          C.make(tu, sp.root, sp.q).notes.forEach((n, i) => add(n.monzo, i === 0 && b === 0));
        }
        if (spec.lap === 4) ch.notes.forEach((n) => add(n.monzo, false));
        tu.setTicks(ticks);
        api.setTuning(t, tu);
      } else if (spec.lap === 4) {
        const ticks = tu.tickSet.slice();
        ch.notes.forEach((n) => {
          if (!ticks.some((x) => Math.abs(x.cents - n.cents) < 0.5)) ticks.push({ cents: n.cents, label: n.name, major: false });
        });
        tu.setTicks(ticks);
        api.setTuning(t, tu);
      }
      api.chord(t, ch);
      api.event(t, 'drift', { cents: spec.drift });
      st.chord = ch;
      const cents = ch.notes.map((n) => n.cents);
      st.voicing = K.voiceLead(st.voicing, cents, 1200, -500, 1000, 4);
      const rootC = ch.root.cents;
      st.pool = [];
      for (const r of PENTA[spec.q === 'min' ? 'min' : 'maj']) {
        const c = rootC + T.ratioCents(r);
        for (let o = -2; o <= 3; o++) {
          const v = c + o * 1200;
          if (v >= 700 && v <= 2500) st.pool.push(v);
        }
      }
      st.pool.sort((a, b) => a - b);
      st.arpPool = K.pool(cents, 0, 2400);
      st.bassRoot = K.into(rootC, -3000, -1800);
      st.tail = K.tail(rootC);
      api.stat(t, `drift ${U.fmtCents(spec.drift, 1)} · ${spec.lap} × 81/80${spec.lap === 4 && spec.drift < -4 * COMMA ? ' + 128/125' : ''}`);
    },

    onBar(st, bar, t, api) {
      if (bar < 16) this.enterChord(st, this.chordAt(st, bar, 0), t, api);
      const lap = Math.floor(bar / 4);
      if (bar % 4 === 0 && bar < 16) api.text(t + 0.05, `LAP ${lap + 1} · C → Am → Dm → G → C`);
      if (bar === 1) api.text(t, 'COMMON TONES HELD PERFECTLY STILL');
      if (bar === 3) api.text(t + api.beatDur * 2, `G → C LANDS 81/80 = ${COMMA.toFixed(2)}¢ LOW`);
      if (bar === 4) api.text(t, '4 PURE FIFTHS = 81/64 ≠ 5/4');
      if (bar === 6) api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
      if (bar === 8) api.text(t, 'KICK TAIL + REVERSE BASS DRIFT WITH THE PUMP', { size: 1.1 });
      if (bar === 15) api.text(t, `${U.fmtCents(-4 * COMMA)}: ALMOST A 12-TET SEMITONE`, { size: 1.2 });
      if (bar === 16) {
        api.text(t, `(5/4)³ = 125/64 · ${DIESIS.toFixed(2)}¢ SHORT OF 2/1`);
        api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
      }
    },

    onStep(st, bar, step, t, api) {
      const sd = api.stepDur, rng = api.rng;
      if (bar >= 16 && step === 8) this.enterChord(st, this.chordAt(st, bar, 1), t, api);
      else if (bar >= 16 && step === 0) this.enterChord(st, this.chordAt(st, bar, 0), t, api);

      const brk = bar < 4, build = bar >= 4 && bar < 8, drop = bar >= 8 && bar < 16, pump = bar >= 16;

      // Lead hook: breakdown (soft) and drop (supersaw).
      const h = K.hookAt(st.hook, step);
      if (h && !build && !(pump && bar === 17 && step >= 12)) {
        const note = st.pool[Math.min(h.idx + 2, st.pool.length - 1)];
        if (drop || pump) {
          api.play(t, 'stab', note, sd * h.len * 0.95, 0.95, {
            voices: 7, spread: 26, cutHi: 7200, cutLo: 3600, sustain: 0.85, decay: 0.35, gain: 0.22,
            release: 0.12, dest: api.E.lead, layer: 'lead',
          });
          api.play(t, 'stab', note - 1200, sd * h.len * 0.95, 0.6, {
            voices: 3, spread: 18, cutHi: 3000, cutLo: 1500, sustain: 0.8, gain: 0.12, dest: api.E.lead, layer: 'lead',
          });
        } else {
          api.play(t, 'lead', note, sd * h.len * 0.9, 0.5, { cut: 2600, vib: 0.005, gain: 0.13 });
        }
      }

      if (brk) {
        if (step === 0) api.play(t, 'pad', st.voicing, api.barDur, 0.85, { attack: 0.35, cut: 2200 });
        if (step % 4 === 0) api.play(t, 'keys', st.voicing, sd * 3.5, 0.55, { index: 1.6, decay: 0.6, gain: 0.2 });
        if (step === 0) api.bass(t, st.bassRoot, api.barDur * 0.95, 0.6, { glide: 0.05 });
      } else if (build) {
        const i = (bar - 4) * 16 + step;
        if (i < 62) K.build(api, t, i, 64, { kick: i < 32 });
        if (step % 2 === 0 && i < 62) api.play(t, 'keys', st.voicing, sd * 1.8, 0.4 + i / 140, { index: 2.2, decay: 0.3, gain: 0.2 });
        if (step === 0) api.bass(t, st.bassRoot, api.barDur * 0.95, 0.55);
        if (i < 62) api.play(t, 'pluck', K.arp(st.arpPool, 'updown', i, rng), sd * 1.2, 0.45, { pan: step % 2 ? 0.4 : -0.4 });
      } else {
        const gap = pump && bar === 17 && step >= 14;
        K.hardDrums(api, step, t, {
          tail: st.tail, rev: st.bassRoot, claps: [4, 12], hats: 0.5, noKick: gap,
          kickP: { decay: 0.34, drive: 0.9, level: 0.5 },
        });
        if (step === 0 && drop) api.play(t, 'stab', st.voicing, sd * 3, 0.8, { voices: 5, spread: 20, cutHi: 6000, cutLo: 1400, gain: 0.18 });
        if (pump && (step === 0 || step === 8)) {
          api.play(t, 'stab', st.voicing, sd * 7, 0.9, { voices: 7, spread: 24, cutHi: 7000, cutLo: 2200, sustain: 0.8, gain: 0.2 });
        }
        if (pump && !gap) K.build(api, t, (bar - 16) * 16 + step, 32);
        if (drop && bar === 15 && step >= 12) K.roll(api, t, 2, sd, 'snare', 0.6, 0.75, 220 + (step - 12) * 40, 260 + (step - 12) * 40);
      }
    },
  });
})(window.XEN);
