/* VIII · EDO ROULETTE — the finale.
 * One chord (C harmonic ninth, 4:5:6:7:9) and one hook, re-tuned every
 * bar: 5, 7, 10, 12, 15, 17, 19, 22, 24, 31, 41, 53 equal divisions of the
 * octave, while the tempo climbs from 150 to 180 bpm. Each EDO maps the
 * chord through its own patent val, so the same shape sounds different in
 * each one. It resolves into pure just intonation, then the outro
 * lets a 4:5:6:7:9:11:13 chord ring out. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit;
  const EDOS = [5, 7, 10, 12, 15, 17, 19, 22, 24, 31, 41, 53];
  const R = EDOS.length; // roulette bars
  const JI_BARS = 2, OUTRO = 4;

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 8, id: 'roulette', title: 'EDO ROULETTE', subtitle: 'one chord, twelve tunings, then the real thing',
    tuningLabel: '5 → 53-EDO → JI', bars: R + JI_BARS + OUTRO,
    bpmAt: (bar) => (bar < R ? 150 + (30 * bar) / (R - 1) : bar < R + JI_BARS ? 180 : 150),
    meter: { steps: 16, groups: [4, 4, 4, 4], label: '4/4' }, inset: 'errors', hue: 330,
    energyAt: (bar) => (bar < R ? 0.8 + (0.2 * bar) / R : bar < R + JI_BARS ? 1 : 0.3 - (bar - R - JI_BARS) * 0.06),

    init(api, t) {
      const rng = api.rng;
      const ji = new T.Just({
        id: 'ji13', name: '13-limit just intonation', subtitle: 'the harmonic series, finally untempered',
        stat: 'pure ratios \u00b7 error 0.00\u00a2 by definition',
        refRatios: ['3/2', '5/4', '7/4', '11/8', '13/8', '9/8'],
      });
      ji.setTicks(['1/1', '9/8', '5/4', '11/8', '3/2', '13/8', '7/4'].map((r) => ({
        cents: T.ratioCents(r), label: r, major: r === '1/1',
      })));
      return {
        voicing: null, ji,
        hook: K.hook(rng, 16, [4, 4, 4, 4], 0.7, 6),
      };
    },

    setChord(st, t, api, ch, lo = -300, hi = 1500) {
      api.chord(t, ch);
      const cents = ch.notes.map((n) => n.cents);
      st.voicing = K.voiceLead(st.voicing, cents, 1200, lo, hi, 5);
      st.pool = K.pool(cents, 700, 2500);
      st.bassRoot = K.into(ch.root.cents, -3000, -1800);
      st.tail = K.tail(ch.root.cents);
    },

    onBar(st, bar, t, api) {
      if (bar < R) {
        const n = EDOS[bar];
        const tu = T.edo(n);
        api.setTuning(t, tu);
        const ch = C.make(tu, 0, 'h9', { fn: `4:5:6:7:9 through ${n}-EDO's patent val` });
        this.setChord(st, t, api, ch);
        const e5 = tu.approx('5/4'), e7 = tu.approx('7/4');
        api.text(t + 0.02, `${n}-EDO · 5/4 ${U.fmtCents(e5.error, 1)} · 7/4 ${U.fmtCents(e7.error, 1)}`, { size: 1.15 });
        const worst = Math.max(...['3/2', '5/4', '7/4', '9/8'].map((r) => Math.abs(tu.approx(r).error)));
        api.stat(t, `${n}-EDO · worst error ${worst.toFixed(1)}¢ · ${bar + 1}/${R}`);
        api.fx(t, 'sweepDown', api.stepDur * 3, 0.5);
        api.play(t, 'stab', st.voicing, api.stepDur * 3, 0.95, { bend: -200, voices: 5, spread: 26, cutHi: 8000, cutLo: 1800, gain: 0.2 });
        if (bar === 0) api.text(t + api.beatDur * 2, 'SAME CHORD · SAME HOOK · NEW TUNING EVERY BAR');
        if (bar === R - 2) api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
      } else if (bar === R) {
        api.setTuning(t, st.ji);
        const ch = C.make(st.ji, [0, 0, 0, 0, 0, 0], 'h9', { fn: 'just intonation · every interval pure' });
        this.setChord(st, t, api, ch);
        api.text(t, 'JUST INTONATION · 0.00¢ ERROR', { size: 1.6 });
        api.stat(t, 'JI · the limit of the roulette as n → ∞');
      } else if (bar === R + 1) {
        const ch = C.make(st.ji, [0, 0, 0, 0, 0, 0], 'h13', { fn: 'otonal heptad · 4:5:6:7:9:11:13' });
        this.setChord(st, t, api, ch);
        api.fx(t, 'riser', api.barDur - api.stepDur * 2, 0.8);
      } else if (bar === R + JI_BARS) {
        const ch = C.make(st.ji, [0, 0, 0, 0, 0, 0], 'h13', { fn: 'let it ring' });
        this.setChord(st, t, api, ch, -600, 1800);
        const all = ch.notes.map((n) => n.cents);
        api.play(t, 'pad', all.map((c) => c - 1200), api.barDur * OUTRO - 0.4, 0.9, { attack: 0.08, cut: 3200, release: 2.5, gain: 0.16 });
        api.bass(t, st.bassRoot, api.barDur * 2, 0.7, { sustain: 0.9 });
        api.text(t + api.beatDur, 'EVERYTHING YOU HEARD WAS GENERATED IN JAVASCRIPT', { size: 1.1 });
        api.text(t + api.beatDur * 5, 'NO SAMPLES · NO LIBRARIES · EIGHT TUNINGS', { size: 1.0 });
        api.stat(t, 'outro · next cycle re-seeds');
      }
      if (bar === R + JI_BARS + OUTRO - 1) api.text(t, 'FIN · RESEEDING', { size: 1.3 });
    },

    onStep(st, bar, step, t, api) {
      const sd = api.stepDur;
      if (bar < R + JI_BARS) {
        const last = bar === R + JI_BARS - 1 && step >= 14;
        K.hardDrums(api, step, t, {
          tail: st.tail, rev: st.bassRoot, claps: [4, 12], hats: bar >= R / 2 ? 1 : 0.5, noKick: last,
          kickP: { decay: 0.3, drive: 0.9, level: 0.5 },
        });
        const h = K.hookAt(st.hook, step);
        if (h && !last) {
          api.play(t, 'stab', st.pool[Math.min(h.idx, st.pool.length - 1)], sd * h.len * 0.95, 0.95, {
            voices: 7, spread: 28, cutHi: 7500, cutLo: 3500, sustain: 0.85, decay: 0.3, gain: 0.2,
            dest: api.E.lead, layer: 'lead',
          });
        }
        if (step % 4 === 0 && step) api.play(t, 'keys', st.voicing, sd * 1.5, 0.6, { index: 2.6, decay: 0.25, gain: 0.2 });
        if (bar >= R - 2 && bar < R) K.build(api, t, (bar - (R - 2)) * 16 + step, 32);
        if (bar === R + 1 && !last) K.build(api, t, step, 16);
        if (bar === R && step === 8) api.play(t, 'stab', st.voicing, sd * 8, 0.8, { voices: 7, spread: 20, cutHi: 7000, cutLo: 2500, sustain: 0.9, gain: 0.2 });
        return;
      }
      // Outro: bells falling down the harmonic series, no drums.
      const o = bar - (R + JI_BARS);
      if (o === 0 && step === 0) api.drum(t, 'hardkick', 1, { tail: api.hz(st.tail), decay: 0.9, drive: 0.9 });
      if (step % 2 === 0 && o < OUTRO - 1) {
        const k = 16 - ((o * 8 + step / 2) % 13);
        const c = 1200 * Math.log2(k); // partial k of C, folded into the bell register
        api.play(t, 'bell', K.into(c, 900, 2700), sd * 3, 0.45 - o * 0.08, { ratio: 2, index: 0.9, decay: 1.6, pan: Math.sin(step) * 0.6 });
      }
    },

    onExit(st, t, api) { api.bassSilence(t); },
  });
})(window.XEN);
