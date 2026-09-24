/* II · SEPTIMAL MEANTONE — happy hardcore in 31-EDO.
 * 31-EDO is (almost exactly) quarter-comma meantone with a near-pure 7/4.
 * Three stacked major thirds make 30\31, a lesser diesis short of the
 * octave, so a chain of major-third modulations sinks one step per lap. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit;
  const PIANO = ['x..x..x...x..x..', 'x.x..x.x..x..x.x', 'x..x.x..x..x.x..', 'x..x..x.x..x.x..'];

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 2, id: 'meantone31', title: 'SEPTIMAL MEANTONE', subtitle: 'happy hardcore in 31 equal steps',
    tuningLabel: '31-EDO', bars: 16, bpm: 172,
    meter: { steps: 16, groups: [4, 4, 4, 4], label: '4/4' }, inset: 'errors', hue: 300,
    energyAt: (bar) => (bar < 8 ? 0.85 : bar < 10 ? 0.35 : bar < 12 ? 0.6 : 1),

    init(api, t) {
      const tu = T.edo(31, { preferFlats: true });
      api.setTuning(t, tu);
      api.bassTimbre(t, { saw: 0.55, sq: 0, sub: 0.8, cutoff: 520, env: 5, q: 6, drive: 0.4, detune: 9,
        lfoDepth: 120, lfoRate: 0.5, level: 0.55, subOct: false });
      const rng = api.rng;
      const step = tu.stepCents;
      const K0 = rng.pick([0, 5, 13, 18]); // C, D, F or G
      const L = [];
      const m3 = (k, qs) => [0, 10, 20, 30].forEach((o, i) => L.push({
        root: k + o, q: qs[i], key: k,
        fn: i < 3 ? `major-third chain ${i + 1}/4 (+${o}\\31)` : '3 × 10\\31 = 30\\31: a diesis short of 2/1',
        tags: i === 3 ? ['(5/4)³ = 125/64 ≠ 2/1', `LESSER DIESIS 128/125 = ${tu.mapRatio('128/125')}\\31 = ${step.toFixed(1)}¢`] : [],
      }));
      m3(K0, ['h7', 'h7', 'h7', 'h9']);
      m3(K0 - 1, ['h9', 'h7', 'h9', 'h7']);
      const k2 = K0 - 2;
      L.push(
        { root: k2 + 5, q: 'sm7', key: k2, fn: 'ii · subminor seventh 12:14:18:21', tags: [] },
        { root: k2 + 18, q: 'h9', key: k2, fn: 'V · harmonic ninth 4:5:6:7:9', tags: [] },
        { root: k2, q: 'maj9', key: k2, fn: 'I · major ninth', tags: [] },
        { root: k2, q: 'h7', key: k2, fn: 'I · harmonic seventh, pure-ish 7/4', tags: [] });
      const k3 = k2 + 1;
      L.push(
        { root: k3, q: 'maj9', key: k3, fn: `I · key +1\\31 (${U.fmtCents(step)})`, tags: [`KEY CHANGE +1\\31 = ${U.fmtCents(step)}`] },
        { root: k3 + 23, q: 'm7', key: k3, fn: 'vi · minor seventh', tags: [] },
        { root: k3 + 5, q: 'sm7', key: k3, fn: 'ii · subminor seventh', tags: [] },
        { root: k3 + 18, q: 'h9', key: k3, fn: 'V · harmonic ninth', tags: [] });
      return {
        tu, K0, chords: L, voicing: null,
        hook: K.hook(rng, 16, [4, 4, 4, 4], 0.55, 6),
        piano: K.pat(rng.pick(PIANO)),
        arpMode: rng.pick(['up', 'updown', 'leap']),
      };
    },

    onBar(st, bar, t, api) {
      const tu = st.tu, spec = st.chords[bar];
      const ch = C.make(tu, spec.root, spec.q, { fn: spec.fn, tags: spec.tags });
      api.chord(t, ch);
      const cents = ch.notes.map((n) => n.cents);
      st.voicing = K.voiceLead(st.voicing, cents, 1200, -150, 1350, 5);
      st.pool = K.pool(cents, 700, 2500);
      st.arpPool = K.pool(cents, 0, 2400);
      st.bassRoot = K.into(ch.root.cents, -3000, -1800);
      st.tail = K.tail(ch.root.cents);
      spec.tags.forEach((tg, i) => api.text(t + (i + 1) * api.beatDur, tg));
      const drift = (spec.key - st.K0) * tu.stepCents;
      api.stat(t, `tonic ${tu.nameOf(spec.key)} · drift ${U.fmtCents(drift)}`);

      if (bar === 0) {
        api.text(t + 0.1, `81/80 → ${tu.mapRatio('81/80')} STEPS: MEANTONE`);
        const a7 = tu.approx('7/4');
        api.text(t + api.beatDur * 2, `7/4 = ${a7.steps}\\31 (${U.fmtCents(a7.error, 2)})`);
      }
      if (bar === 5) api.text(t, 'THE TONIC SINKS ONE DIESIS PER LAP');
      if (bar === 8) api.text(t, 'SUBMINOR ii → HARMONIC V9 → I');
      if (bar === 10) api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
      if (bar === 15) api.fx(t, 'riser', api.barDur, 0.7);
      const drop = bar < 8 || bar >= 12;
      if (drop) {
        api.play(t, 'stab', st.voicing, api.stepDur * 3, 0.85, {
          bend: -260, bendTime: 0.1, voices: 5, spread: 24, cutHi: 7000, cutLo: 1500, gain: 0.22,
        });
      }
    },

    onStep(st, bar, step, t, api) {
      const sd = api.stepDur, rng = api.rng;
      const drop = bar < 8 || bar >= 12;
      const brk = bar >= 8 && bar < 10;
      if (drop) {
        K.hardDrums(api, step, t, {
          tail: st.tail, claps: [4, 12], hats: 0.7,
          kickP: { decay: 0.24, drive: 0.75, level: 0.55 },
        });
        if ((bar === 7 || bar === 15) && step >= 12) {
          const k = step - 12;
          K.roll(api, t, 2, sd, 'snare', 0.5 + k * 0.12, 0.6 + k * 0.12, 200 + k * 45, 230 + k * 45);
        }
        if (step % 4 === 2) api.bass(t, st.bassRoot + (step === 10 && bar % 2 ? 1200 : 0), sd * 1.6, 0.85);
        if (st.piano[step]) {
          const top = st.voicing[st.voicing.length - 1];
          api.play(t, 'keys', st.voicing.concat([top + 1200]), sd * 2, 0.5 + 0.35 * st.piano[step],
            { index: 2.6, ratio: 1, decay: 0.3, gain: 0.24 });
        }
        if ((bar >= 4 && bar < 8) || bar >= 12) {
          const h = K.hookAt(st.hook, step);
          if (h) {
            api.play(t, 'stab', st.pool[Math.min(h.idx, st.pool.length - 1)], sd * h.len * 0.95, 0.9, {
              voices: 7, spread: 28, cutHi: 6500, cutLo: 3000, sustain: 0.8, decay: 0.3, gain: 0.2,
              dest: api.E.lead, layer: 'lead',
            });
          }
        }
      } else {
        const i = (bar - 8) * 16 + step;
        if (brk && step === 0) api.play(t, 'pad', st.voicing, api.barDur, 0.8, { attack: 0.25, cut: 2400 });
        if (i < 62) {
          api.play(t, 'pluck', K.arp(st.arpPool, st.arpMode, i, rng), sd * 1.5, 0.55 + 0.2 * (step % 4 === 0),
            { pan: step % 2 ? 0.4 : -0.4 });
        }
        if (brk) {
          if (step % 4 === 0) api.play(t, 'keys', st.voicing, sd * 3, 0.45, { index: 2, decay: 0.4, gain: 0.2 });
          if (step % 2 === 0) api.drum(t, 'hat', 0.25);
        } else {
          const j = (bar - 10) * 16 + step;
          if (j < 30) {
            K.build(api, t, j, 32);
            if (step % 2 === 0) api.play(t, 'keys', st.voicing, sd * 1.5, 0.35 + j / 60, { index: 2.4, decay: 0.25, gain: 0.2 });
          }
        }
      }
    },
  });
})(window.XEN);
