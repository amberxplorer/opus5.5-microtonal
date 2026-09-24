/* VII · PORCUPINE ENGINE — hardcore / breakcore in 22-EDO.
 * 22-EDO has sharp "superpyth" fifths (13\22 = 709.1¢) and tempers out
 * several commas at once, so it supports several temperaments:
 *   porcupine  250/243 → three 10/9 steps make a 4/3
 *   pajara     50/49   → 7/5 and 10/7 are the same half-octave
 *   superpyth  64/63   → four fifths up lands on a 9/7-ish third
 * Root motion follows those identities. On top of the 4/4 kicks,
 * chopped breakbeat snares play, and the halftime bars go full gabber. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit;

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 7, id: 'porcupine', title: 'PORCUPINE ENGINE', subtitle: 'three temperaments in one tuning',
    tuningLabel: '22-EDO', bars: 16, bpm: 180,
    meter: { steps: 16, groups: [4, 4, 4, 4], label: '4/4' }, inset: 'errors', hue: 260,
    energyAt: (bar) => (bar < 8 ? 0.95 : bar < 10 ? 0.8 : bar < 12 ? 0.6 : 1),

    init(api, t) {
      const tu = T.edo(22);
      api.setTuning(t, tu);
      api.bassTimbre(t, { saw: 0.7, sub: 0.7, cutoff: 360, env: 9, q: 9, drive: 0.8, detune: 18,
        lfoDepth: 260, lfoRate: 2.2, level: 0.45 });
      const rng = api.rng;
      const k = rng.pick([0, 9, 13]); // C, F, G
      const gen = tu.mapRatio('10/9'), half = tu.mapRatio('7/5'), fifth = tu.mapRatio('3/2');
      const L = [];
      [0, 1, 2, 3].forEach((i) => L.push({ root: k - gen * i, q: i === 3 ? 'h9' : 'h7',
        fn: `porcupine step −${gen}\\22 × ${i}${i === 3 ? ` = −${3 * gen}\\22, a 4/3 down` : ''}` }));
      [0, 1, 2, 3].forEach((i) => L.push({ root: k + (i % 2) * half, q: i < 2 ? 'h7' : 'h9',
        fn: i % 2 ? `pajara swap +${half}\\22 = half an octave` : 'home' }));
      L.push({ root: k, q: 'und', fn: 'undecimal tetrad 8:10:11:12' },
        { root: k + tu.mapRatio('5/4'), q: 'und', fn: 'undecimal tetrad on the third' },
        { root: k + fifth, q: 'h11', fn: 'harmonic 11th on V' },
        { root: k + fifth, q: 'h7', fn: 'V · harmonic seventh' });
      [0, 1, 2, 3].forEach((i) => L.push({ root: k + fifth * i, q: i === 3 ? 'h9' : 'h7',
        fn: `superpyth fifth × ${i} (+${fifth * i}\\22)` }));
      return {
        tu, chords: L, voicing: null, gen, half, fifth,
        hook: K.hook(rng, 16, [4, 4, 4, 4], 0.7, 7),
        chop: K.chopMap(rng, 0.5),
      };
    },

    onBar(st, bar, t, api) {
      const tu = st.tu, spec = st.chords[bar];
      const ch = C.make(tu, spec.root, spec.q, { fn: spec.fn });
      api.chord(t, ch);
      const cents = ch.notes.map((n) => n.cents);
      st.voicing = K.voiceLead(st.voicing, cents, 1200, -200, 1300, 5);
      st.pool = K.pool(cents, 800, 2600);
      st.arpPool = K.pool(cents, 0, 2400);
      st.bassRoot = K.into(ch.root.cents, -3000, -1800);
      st.tail = K.tail(ch.root.cents);
      st.chop = K.chopMap(api.rng, bar >= 12 ? 0.85 : 0.5);
      const v = (r) => tu.mapRatio(r);
      if (bar === 0) {
        api.text(t + 0.1, `SUPERPYTH FIFTH ${st.fifth}\\22 = ${tu.approx('3/2').cents.toFixed(1)}¢`);
        api.text(t + api.beatDur * 2, `250/243 → ${v('250/243')} STEPS: PORCUPINE`);
      }
      if (bar === 3) api.text(t, `(10/9)³ ≈ 4/3 · ${3 * st.gen}\\22 = ${(3 * st.gen * tu.stepCents).toFixed(1)}¢`);
      if (bar === 4) api.text(t, `50/49 → ${v('50/49')} STEPS: 7/5 = 10/7 = ${st.half}\\22 (PAJARA)`);
      if (bar === 8) api.text(t, 'HALFTIME GABBER', { size: 1.5 });
      if (bar === 9) api.text(t, `11/8 = ${v('11/8')}\\22 (${U.fmtCents(tu.approx('11/8').error, 1)})`);
      if (bar === 10) {
        api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
        api.text(t, 'PORCUPINE[7] = 3 3 3 3 3 3 4');
      }
      if (bar === 12) api.text(t, `64/63 → ${v('64/63')} STEPS: SUPERPYTH`, { size: 1.1 });
      if (bar === 15) api.fx(t, 'riser', api.barDur, 0.8);
      api.stat(t, `${tu.nameOf(spec.root)} · val ${tu.valString()}`);
      if (bar < 8 || bar >= 12) {
        api.play(t, 'stab', st.voicing, api.stepDur * 3, 0.9, { bend: -300, voices: 5, spread: 30, cutHi: 8000, cutLo: 1500, gain: 0.2 });
      }
    },

    onStep(st, bar, step, t, api) {
      const sd = api.stepDur, rng = api.rng;
      const halftime = bar === 8 || bar === 9;
      const build = bar === 10 || bar === 11;
      const last = bar === 15 && step >= 12;

      if (halftime) {
        if (step === 0 || step === 6 || step === 10) {
          api.drum(t, 'hardkick', 1, { tail: api.hz(st.tail), decay: 0.5, drive: 1, f0: 1400, level: 0.5 });
          api.duck(t, 0.7, 0.2);
        }
        if (step === 8) { api.drum(t, 'snare', 1, { drive: 0.6, decay: 0.22 }); api.glitch(t, 1); }
        if (step % 2 === 1) api.drum(t, 'hat', 0.4);
        if (step === 14 && bar === 9) K.roll(api, t, 6, sd * 2, 'snare', 0.5, 0.9, 260, 420);
        // stutter stab: the chord retriggered in 32nds
        if (step === 12) {
          for (let i = 0; i < 6; i++) api.play(t + (i * sd) / 2, 'stab', st.voicing, sd * 0.4, 0.8 - i * 0.08, { voices: 3, cutHi: 6000, cutLo: 2000, gain: 0.18 });
          api.glitch(t, 0.7);
        }
        if (step % 4 === 2) api.bass(t, st.bassRoot, sd * 1.8, 0.9);
        return;
      }
      if (build) {
        const i = (bar - 10) * 16 + step;
        if (i < 30) K.build(api, t, i, 32, { kick: true });
        // porcupine[7] scale runs
        const gen = st.gen;
        const deg = i % 14 < 7 ? i % 7 : 6 - (i % 7);
        const c = K.into(st.voicing[0], 300, 1500) + [0, 3, 6, 9, 12, 15, 18][deg] * st.tu.stepCents + (i >= 16 ? 1200 : 0);
        if (i < 30) api.play(t, 'pluck', c, sd * 1.2, 0.55, { pan: deg / 3 - 1, gain: 0.12 });
        void gen;
        return;
      }
      K.hardDrums(api, step, t, {
        tail: st.tail, claps: null, hats: 1, noKick: last,
        kickP: { decay: 0.22, drive: 0.9, level: 0.52 },
      });
      // chopped break snares ride on top of the four-on-the-floor
      const b = K.breakStep(st.chop, step);
      if (b.s && !last) api.drum(t, 'snare', b.s * 0.85, { pitch: 200, decay: b.s < 0.5 ? 0.07 : 0.14, pan: rng.range(-0.2, 0.2) });
      if (step % 4 === 2 && !last) api.bass(t, st.bassRoot + (step === 6 ? 1200 : 0), sd * 1.6, 0.9);
      if (bar >= 4 && !last) {
        const h = K.hookAt(st.hook, step);
        if (h) {
          api.play(t, 'stab', st.pool[Math.min(h.idx, st.pool.length - 1)], sd * h.len * 0.95, 0.9, {
            voices: 7, spread: 32, cutHi: 7500, cutLo: 3500, sustain: 0.8, decay: 0.3, gain: 0.19,
            dest: api.E.lead, layer: 'lead',
          });
        }
      }
      if (bar >= 12 && step % 2 === 1 && !last) api.drum(t + sd / 2, 'hat', 0.3);
      if (last) {
        K.roll(api, t, 4, sd, 'snare', 0.6 + (step - 12) * 0.08, 0.75 + (step - 12) * 0.06, 260 + (step - 12) * 40, 300 + (step - 12) * 40);
        if (step === 12) api.glitch(t, 1);
      }
    },
  });
})(window.XEN);
