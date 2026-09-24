/* V · TRITAVE — rawstyle in the Bohlen–Pierce scale.
 * 13 equal steps divide the tritave 3/1 instead of the octave. Chords are
 * built from odd harmonics (3:5:7, 5:7:9), and timbres use odd harmonics
 * too (square waves, a clarinet-like wave), which is what makes BP sound
 * consonant. The arpeggio cycles every 13 steps against 16-step bars, and
 * two bars switch to 13/16 outright. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit;
  const LAMBDA = [0, 2, 3, 4, 6, 7, 9, 10, 12];
  const MAJ = [0, 3, 6, 7, 9, 10];   // roots where 3:5:7 stays inside Lambda
  const MIN = [0, 2, 3, 6, 9, 12];   // roots where 5:7:9 stays inside Lambda
  const MOVES = [3, 4, 6, 7, 9, 10]; // root motions by BP consonances
  const FOUR = { steps: 16, groups: [4, 4, 4, 4], label: '4/4' };
  const THIRTEEN = { steps: 13, groups: [3, 3, 3, 2, 2], label: '13/16 (3+3+3+2+2)' };

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 5, id: 'tritave', title: 'TRITAVE', subtitle: 'Bohlen–Pierce: no octaves, only odd harmonics',
    tuningLabel: 'Bohlen–Pierce 13-ED3', bars: 16, bpm: 155,
    meterAt: (bar) => (bar === 8 || bar === 9 ? THIRTEEN : FOUR),
    inset: 'errors', hue: 200,
    energyAt: (bar) => (bar < 8 ? 0.9 : bar < 10 ? 0.7 : bar < 12 ? 0.6 : 1),

    init(api, t) {
      const tu = T.bp();
      api.setTuning(t, tu);
      api.bassTimbre(t, { saw: 0, sq: 0.55, sub: 0.8, cutoff: 700, env: 4, q: 4, drive: 0.6, lfoDepth: 90, lfoRate: 0.8, level: 0.5 });
      const rng = api.rng;
      // Progression: 8 chords, 2 bars each, walking by BP consonances.
      const prog = [{ root: 0, q: 'bpMaj' }];
      for (let i = 1; i < 8; i++) {
        const prev = prog[i - 1].root;
        const opts = [];
        for (const mv of MOVES) {
          const r = U.mod(prev + mv, 13);
          if (MAJ.includes(r)) opts.push({ root: r, q: i === 7 ? 'bp9' : 'bpMaj' });
          if (MIN.includes(r)) opts.push({ root: r, q: 'bpMin' });
        }
        prog.push(i === 7 && MAJ.includes(0) && prev !== 0 ? { root: 0, q: 'bp9' } : rng.pick(opts));
      }
      const scale = [];
      for (let k = -1; k < 3; k++) for (const s of LAMBDA) scale.push((s + 13 * k) * tu.stepCents);
      return {
        tu, prog, voicing: null, g: 0,
        scale: scale.filter((c) => c >= 100 && c <= 3200),
        hook: K.hook(rng, 16, [4, 4, 4, 4], 0.5, 6),
      };
    },

    onBar(st, bar, t, api) {
      const tu = st.tu;
      if (bar % 2 === 0) {
        const spec = st.prog[bar / 2];
        const qn = { bpMaj: '3:5:7', bpMin: '5:7:9', bp9: '3:5:7:9' }[spec.q];
        const ch = C.make(tu, spec.root, spec.q, { fn: `${qn} · root ${spec.root}\\13 · Lambda degree ${LAMBDA.indexOf(spec.root) + 1}` });
        api.chord(t, ch);
        const cents = ch.notes.map((n) => n.cents);
        st.voicing = K.voiceLead(st.voicing, cents, tu.periodCents, -900, 1500, 4);
        st.pool = K.pool(cents, 900, 3200, tu.periodCents);
        st.bassRoot = K.into(ch.root.cents, -3500, -3500 + tu.periodCents, tu.periodCents);
        st.tail = K.tail(ch.root.cents, tu.periodCents);
        api.stat(t, `root ${tu.nameOf(spec.root)} · ${spec.root}\\13 · ${qn}`);
      }
      const f = (r) => `${r} = ${tu.mapRatio(r)}\\13 (${U.fmtCents(tu.approx(r).error, 1)})`;
      if (bar === 0) {
        api.text(t + 0.1, `13 STEPS OF 3/1 · STEP = ${tu.stepCents.toFixed(2)}¢`);
        api.text(t + api.beatDur * 2, 'NO OCTAVES: THE PERIOD IS THE TRITAVE');
      }
      if (bar === 2) api.text(t, f('5/3'));
      if (bar === 3) api.text(t, f('7/3'));
      if (bar === 4) api.text(t, 'SQUARE WAVES = ODD HARMONICS ONLY');
      if (bar === 6) api.text(t, 'ARP CYCLE: 13 STEPS AGAINST 16');
      if (bar === 8) api.text(t, 'METER 13/16 = 3+3+3+2+2', { size: 1.2 });
      if (bar === 10) api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
      if (bar === 12) api.text(t, 'LAMBDA MODE: C D E F G H J A B');
      if (bar === 15) api.fx(t, 'riser', api.barDur, 0.7);
    },

    onStep(st, bar, step, t, api) {
      const sd = api.stepDur;
      const g = st.g++;
      const odd = bar === 8 || bar === 9;
      const build = bar === 10 || bar === 11;
      // 13-step arpeggio over the Lambda scale, independent of the bar line.
      if (!build || step % 2 === 0) {
        const i = g % 13;
        const pool = st.scale;
        const note = pool[(i * 5 + Math.floor(g / 13) * 2) % pool.length];
        api.play(t, 'pluck', note, sd * 1.2, 0.35 + (i === 0 ? 0.3 : 0), { wave: api.E.waves.oddBright, pan: (i / 12) * 1.2 - 0.6, gain: 0.1 });
      }
      if (odd) {
        const starts = [0, 3, 6, 9, 11];
        if (starts.includes(step)) {
          api.drum(t, 'hardkick', step === 0 ? 1 : 0.85, { tail: api.hz(st.tail), decay: 0.28, drive: 0.95 });
          api.duck(t, 0.6, 0.1);
          api.bass(t, st.bassRoot + (step === 9 ? st.tu.periodCents : 0), sd * 2, 0.8);
        }
        if (step === 9) api.drum(t, 'clap', 0.9);
        if ([1, 2, 4, 5, 7, 8].includes(step)) api.drum(t, 'metal', 0.5, { freq: 480 + step * 30, decay: 0.08 });
        if (step === 0) api.play(t, 'stab', st.voicing, sd * 3, 0.8, { wave: api.E.waves.odd, voices: 3, spread: 12, cutHi: 5000, cutLo: 1200, gain: 0.22 });
        return;
      }
      if (build) {
        const i = (bar - 10) * 16 + step;
        if (i < 30) K.build(api, t, i, 32);
        if (step % 4 === 0 && i < 30) api.play(t, 'stab', st.voicing, sd * 2, 0.4 + i / 50, { wave: api.E.waves.odd, voices: 3, gain: 0.18 });
        return;
      }
      K.hardDrums(api, step, t, {
        tail: st.tail, rev: st.bassRoot, claps: [4, 12], hats: 0.4,
        kickP: { decay: 0.4, drive: 0.95, level: 0.5 }, revDrive: 0.85,
      });
      if (step === 3 || step === 11) api.drum(t, 'metal', 0.55, { freq: 510, decay: 0.12 });
      if (step === 0 && bar % 2 === 0) {
        api.play(t, 'stab', st.voicing, sd * 6, 0.85, { wave: api.E.waves.odd, voices: 3, spread: 14, cutHi: 5500, cutLo: 1400, gain: 0.22, sustain: 0.7 });
      }
      // Screech-ish square lead on the hook.
      if (bar >= 2 && !(bar === 15 && step >= 12)) {
        const h = K.hookAt(st.hook, step);
        if (h) {
          api.play(t, 'lead', st.pool[Math.min(h.idx, st.pool.length - 1)], sd * h.len * 0.9, 0.8, {
            type: 'square', sub: false, cut: 3800, q: 5, vib: 0.012, vibRate: 6.5, gain: 0.16,
          });
        }
      }
      if (bar === 15 && step >= 12) K.roll(api, t, 2, sd, 'snare', 0.6, 0.8, 230 + (step - 12) * 40, 270 + (step - 12) * 40);
    },
  });
})(window.XEN);
