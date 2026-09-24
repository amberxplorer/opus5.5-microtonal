/* VI · FIFTY-THREE COMMAS — aksak hardstyle in 53-EDO.
 * 53-EDO's step (the Holdrian comma, 22.64¢) is almost exactly the
 * syntonic comma, and its fifth is 0.07¢ from pure. The melody uses a
 * Hicaz-like scale counted in commas (5 + 12 + 5 | 9 | 5 + 8 + 9) and slides
 * between notes one comma at a time. The kick keeps a limping 9/8
 * (2+2+2+3) pulse, so two kicks land back to back at every barline. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit;
  const D = 9;                                   // D in 53-EDO steps from C
  const SCALE = [0, 5, 17, 22, 31, 36, 44, 53];  // Hicaz-like, relative to D
  // bar → [root steps, quality]
  const PROG = [
    [D, 'maj'], [D, 'maj'], [D + 5, 'maj'], [D, 'maj'], [D + 22, 'min'], [D, 'maj'],
    null, null, // breakdown bars are special
    [D + 44 - 53, 'min'], [D + 5, 'maj'],
    [D, 'maj'], [D + 5, 'maj'], [D + 22, 'min'], [D, 'maj'],
  ];
  const ROMAN = { 0: 'i', 5: '♭II', 22: 'iv', [44 - 53]: '♭vii' };

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 6, id: 'fiftythree', title: 'FIFTY-THREE COMMAS', subtitle: 'aksak hardstyle, one comma at a time',
    tuningLabel: '53-EDO', bars: 14, bpm: 160,
    meter: { steps: 18, groups: [4, 4, 4, 6], label: '9/8 (2+2+2+3)' }, inset: 'errors', hue: 100,
    energyAt: (bar) => (bar < 6 ? 0.9 : bar < 8 ? 0.35 : bar < 10 ? 0.6 : 1),

    init(api, t) {
      const tu = T.edo(53);
      api.setTuning(t, tu);
      api.bassTimbre(t, { saw: 0.5, sub: 0.85, cutoff: 480, env: 5, q: 5, drive: 0.5, detune: 8, lfoDepth: 100, level: 0.5 });
      const rng = api.rng;
      const mel = [];
      for (let o = -1; o <= 1; o++) for (const s of SCALE.slice(0, 7)) mel.push(D + s + 53 * o);
      return {
        tu, rng, voicing: null, deg: 7, prevNote: null,
        melSteps: mel.filter((s) => s * tu.stepCents >= 500 && s * tu.stepCents <= 2300),
        rhythm: K.rhythm(rng, 18, [4, 4, 4, 6], 0.55),
      };
    },

    setChord(st, t, api, ch) {
      api.chord(t, ch);
      const cents = ch.notes.map((n) => n.cents);
      st.voicing = K.voiceLead(st.voicing, cents, 1200, -300, 1200, 4);
      st.bassRoot = K.into(ch.root.cents, -3000, -1800);
      st.tail = K.tail(ch.root.cents);
    },

    onBar(st, bar, t, api) {
      const tu = st.tu;
      const spec = PROG[bar];
      if (spec) {
        const rel = spec[0] - D;
        const ch = C.make(tu, spec[0], spec[1], { fn: `${ROMAN[rel] || 'i'} of a Hicaz-like mode on D` });
        this.setChord(st, t, api, ch);
      } else if (bar === 6) {
        const notes = [0, 1, 2, 3].map((k) => ({ cents: (D + 53 + k) * tu.stepCents, name: tu.nameOf(D + k) }));
        const ch = C.raw(tu, {
          notes, rootName: tu.nameOf(D), sym: 'cluster', quality: 'comma cluster',
          chordStr: '0·1·2·3\\53', relStr: '0 · 1 · 2 · 3', relSuffix: '\\53',
          fn: `four pitches ${tu.stepCents.toFixed(2)}¢ apart: pure beating`, complexity: 9.5,
        });
        this.setChord(st, t, api, ch);
        api.play(t, 'pad', notes.map((n) => n.cents), api.barDur, 0.9, { attack: 0.15, cut: 3000, gain: 0.16 });
        api.text(t, `COMMA CLUSTER · ${tu.stepCents.toFixed(2)}¢ STEPS → BEATING`, { size: 1.1 });
      }
      if (bar === 0) {
        api.text(t + 0.1, `3/2 = 31\\53 (${U.fmtCents(tu.approx('3/2').error, 2)})`);
        api.text(t + api.beatDur * 2, `HOLDRIAN COMMA 1200/53 = ${tu.stepCents.toFixed(2)}¢`);
      }
      if (bar === 2) api.text(t, 'AKSAK 9/8 = 2+2+2+3');
      if (bar === 3) api.text(t, 'HICAZ-LIKE TETRACHORD 5+12+5 COMMAS');
      if (bar === 4) api.text(t, `53 FIFTHS ≈ 31 OCTAVES · MERCATOR'S COMMA ${(53 * T.ratioCents('3/1') - 84 * 1200).toFixed(2)}¢`);
      if (bar === 7) api.text(t, `5/4 = ${tu.mapRatio('5/4')}\\53 · 81/64 = ${tu.mapRatio('81/64')}\\53 · ONE STEP = 81/80`, { size: 1.1 });
      if (bar === 8) api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
      if (bar === 12) api.text(t, 'BLAST', { size: 1.6 });
      if (bar === 13) api.fx(t, 'riser', api.barDur, 0.7);
      api.stat(t, `koma ${tu.stepCents.toFixed(2)}¢ · bar ${bar + 1}/14 · 9/8`);
    },

    onStep(st, bar, step, t, api) {
      const tu = st.tu, sd = api.stepDur, rng = st.rng;
      const brk = bar === 6 || bar === 7, build = bar === 8 || bar === 9;

      // 5/4 vs 81/64: the same D chord with its third one comma apart.
      if (bar === 7 && (step === 0 || step === 9)) {
        const third = step === 0 ? 17 : 18;
        const ch = C.raw(tu, {
          notes: [D, D + third, D + 31].map((s) => ({ cents: s * tu.stepCents, name: tu.nameOf(s) })),
          rootName: 'D', sym: step === 0 ? '(5/4)' : '(81/64)', quality: step === 0 ? 'just major third' : 'Pythagorean major third',
          chordStr: step === 0 ? '4:5:6' : '64:81:96', ratios: step === 0 ? ['1/1', '5/4', '3/2'] : ['1/1', '81/64', '3/2'],
          relStr: `0 · ${third} · 31`, relSuffix: '\\53',
          fn: step === 0 ? '17\\53: the syntonic third' : '18\\53: four fifths up, one comma sharp',
        });
        this.setChord(st, t, api, ch);
        api.play(t, 'keys', st.voicing, sd * 8.5, 0.8, { index: 1.4, decay: 0.8, gain: 0.24 });
      }

      // Melody: Hicaz-like walk with comma slides.
      const r = st.rhythm.find((x) => x.step === step);
      const melodyOn = !build && !(bar === 13 && step >= 12) && bar !== 6;
      if (r && melodyOn) {
        const n = st.melSteps.length;
        st.deg = U.clamp(st.deg + rng.pick([-2, -1, -1, 1, 1, 2]), 0, n - 1);
        if (step === 0 && rng.chance(0.5)) st.deg = st.melSteps.indexOf(D + 53) >= 0 ? st.melSteps.indexOf(D + 53) : st.deg;
        const s = st.melSteps[st.deg];
        const cents = s * tu.stepCents;
        const slide = r.len >= 2 && rng.chance(0.55);
        const from = slide ? api.hz(cents - rng.pick([1, 2, 3]) * tu.stepCents) : null;
        api.play(t, 'lead', cents, sd * r.len * 0.92, brk ? 0.5 : 0.85, {
          from, glide: 0.07, cut: 3400, q: 3, vib: 0.009, vibRate: 6.2, gain: brk ? 0.12 : 0.16,
        });
      }

      if (brk) {
        if (step % 2 === 0) api.drum(t, 'hat', 0.2 + (step % 4 === 0 ? 0.15 : 0));
        if (bar === 7 && [0, 4, 8, 12].includes(step)) api.drum(t, 'tom', 0.5, { freq: 110 + step * 4 });
        return;
      }
      if (build) {
        const i = (bar - 8) * 18 + step;
        if (i < 34) K.build(api, t, i, 36, { kick: true });
        if (step % 2 === 0 && i < 34) api.play(t, 'keys', st.voicing, sd * 1.6, 0.35 + i / 80, { index: 2.4, decay: 0.3, gain: 0.2 });
        return;
      }
      const blast = bar === 12;
      const gap = bar === 13 && step >= 14;
      K.hardDrums(api, step, t, {
        kicks: [0, 4, 8, 12, 16], offs: [2, 6, 10, 14], claps: [4, 12], hats: blast ? 1 : 0.5,
        tail: st.tail, rev: st.bassRoot, noKick: gap, kickP: { decay: 0.3, drive: 0.88, level: 0.5 },
      });
      if (blast) {
        if (step % 2 === 1) api.drum(t, 'snare', 0.55, { pitch: 220, decay: 0.08 });
        if (step % 2 === 1) api.drum(t, 'kick', 0.5, { decay: 0.12, f0: 180 });
      }
      if (bar === 13 && step >= 12 && !gap) K.roll(api, t, 2, sd, 'snare', 0.6, 0.8, 240 + (step - 12) * 30, 270 + (step - 12) * 30);
      if (step === 0 || step === 12) {
        api.play(t, 'stab', st.voicing, sd * 3, step === 0 ? 0.85 : 0.6, {
          voices: 5, spread: 18, cutHi: 6000, cutLo: 1300, gain: 0.18, wave: api.E.waves.brass,
        });
      }
    },
  });
})(window.XEN);
