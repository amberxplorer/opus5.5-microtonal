/* III · NINETEEN DOORS — happy hardcore in 19-EDO.
 * 19-EDO's minor third (5\19) is within 0.2¢ of a pure 6/5, and because
 * gcd(5, 19) = 1 a chain of minor thirds walks through all 19 keys before
 * it comes home. The chord changes every three beats against the 4/4 kick,
 * so harmony and groove only realign every four chords. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, C = X.C, K = X.Kit;
  const DOOR = 12; // steps per chord (three beats)

  X.SECTIONS = X.SECTIONS || [];
  X.SECTIONS.push({
    order: 3, id: 'nineteen', title: 'NINETEEN DOORS', subtitle: 'a minor-third cycle through every key',
    tuningLabel: '19-EDO', bars: 16, bpm: 176,
    meter: { steps: 16, groups: [4, 4, 4, 4], label: '4/4' }, inset: 'errors', hue: 160,
    energyAt: (bar) => (bar < 6 ? 0.9 : bar < 8 ? 0.4 : bar < 10 ? 0.65 : 1),

    init(api, t) {
      const tu = T.edo(19);
      api.setTuning(t, tu);
      api.bassTimbre(t, { saw: 0.6, sub: 0.75, cutoff: 600, env: 6, q: 7, drive: 0.55, detune: 14,
        lfoDepth: 200, lfoRate: 1.1, level: 0.5 });
      const rng = api.rng;
      const m3 = tu.approx('6/5');
      return {
        tu, m3, r0: rng.pick([0, 3, 11, 14]), voicing: null, door: -1,
        hook: K.hook(rng, DOOR, [3, 3, 3, 3], 0.65, 6),
        arpMode: rng.pick(['updown', 'spiral']),
      };
    },

    onBar(st, bar, t, api) {
      if (bar === 0) {
        api.text(t + 0.1, `MINOR THIRD ${st.m3.steps}\\19 = ${st.m3.cents.toFixed(1)}¢ (6/5 ${U.fmtCents(st.m3.error, 2)})`);
        api.text(t + api.beatDur * 3, `gcd(${st.m3.steps}, 19) = ${U.gcd(st.m3.steps, 19)} → EVERY KEY GETS VISITED`);
      }
      if (bar === 2) api.text(t, 'CHORD EVERY 3 BEATS · HARMONIC RHYTHM 3:4');
      if (bar === 6) api.text(t, `E♯ = F♭ · C♯ ≠ D♭ (${st.tu.stepCents.toFixed(1)}¢ APART)`);
      if (bar === 8) api.fx(t, 'riser', api.barDur * 2 - api.stepDur * 2, 1);
      if (bar === 15) {
        api.fx(t, 'riser', api.barDur, 0.6);
        api.text(t + api.beatDur * 2, `19-TONE CHROMATIC RUN · 19 × ${st.tu.stepCents.toFixed(2)}¢ = 1200¢`);
      }
    },

    onStep(st, bar, step, t, api) {
      const tu = st.tu, sd = api.stepDur, rng = api.rng;
      const g = bar * 16 + step;
      const ds = g % DOOR;
      const drop = bar < 6 || bar >= 10;
      const brk = bar >= 6 && bar < 8;
      const build = bar >= 8 && bar < 10;

      if (ds === 0) {
        st.door = g / DOOR;
        const k = st.door;
        const root = st.r0 + st.m3.steps * k;
        const q = k % 2 ? 'maj7' : 'm9';
        const home = k > 0 && k % 19 === 0;
        const ch = C.make(tu, root, q, {
          fn: home ? 'home again · all 19 keys visited' : `door ${(k % 19) + 1}/19 · +${U.mod(st.m3.steps * k, 19)}\\19 from home`,
        });
        api.chord(t, ch);
        const cents = ch.notes.map((n) => n.cents);
        st.voicing = K.voiceLead(st.voicing, cents, 1200, -200, 1300, 5);
        st.pool = K.pool(cents, 700, 2500);
        st.arpPool = K.pool(cents, 0, 2400);
        st.bassRoot = K.into(ch.root.cents, -3000, -1800);
        st.tail = K.tail(ch.root.cents);
        api.stat(t, `door ${(k % 19) + 1} / 19 · ${tu.nameOf(root)}`);
        if (home) api.text(t, 'ALL 19 KEYS VISITED · HOME', { size: 1.3 });
        if (drop) {
          api.play(t, 'stab', st.voicing, sd * 3, 0.85, { bend: -240, voices: 5, spread: 26, cutHi: 7500, cutLo: 1600, gain: 0.2 });
        }
      }

      if (drop) {
        const lastBar = bar === 15;
        K.hardDrums(api, step, t, {
          tail: st.tail, claps: [4, 12], hats: 0.8,
          kickP: { decay: 0.22, drive: 0.8, level: 0.55 }, noKick: lastBar && step >= 8,
        });
        if (step % 4 === 2 && !(lastBar && step >= 8)) api.bass(t, st.bassRoot + (step === 14 ? 1200 : 0), sd * 1.5, 0.85);
        if ([0, 3, 6, 8, 10].includes(ds) && !(lastBar && step >= 8)) {
          api.play(t, 'keys', st.voicing, sd * 1.5, ds === 0 ? 0.9 : 0.6, { index: 2.8, decay: 0.28, gain: 0.22 });
        }
        if (bar >= 2 && !(lastBar && step >= 8)) {
          const h = K.hookAt(st.hook, ds);
          if (h) {
            api.play(t, 'stab', st.pool[Math.min(h.idx, st.pool.length - 1)], sd * h.len * 0.95, 0.9, {
              voices: 7, spread: 30, cutHi: 7000, cutLo: 3200, sustain: 0.8, decay: 0.3, gain: 0.19,
              dest: api.E.lead, layer: 'lead',
            });
          }
        }
        if (lastBar && step >= 8) {
          // chromatic run: all 19 steps of the octave in eight 16ths
          if (step === 8) {
            const base = K.into(st.r0 * tu.stepCents, 600, 1800);
            for (let i = 0; i <= 19; i++) {
              api.play(t + (i * sd * 8) / 20, 'pluck', base + i * tu.stepCents, sd * 0.6, 0.55 + i / 40,
                { pan: (i / 19) * 1.4 - 0.7, gain: 0.14 });
            }
          }
          K.roll(api, t, 2, sd, 'snare', 0.45 + (step - 8) * 0.06, 0.5 + (step - 8) * 0.06, 220 + (step - 8) * 25, 240 + (step - 8) * 25);
        }
      } else if (brk) {
        if (ds === 0) api.play(t, 'pad', st.voicing, sd * DOOR, 0.8, { attack: 0.2, cut: 2600 });
        api.play(t, 'pluck', K.arp(st.arpPool, st.arpMode, g, rng), sd * 1.4, 0.5 + 0.2 * (step % 4 === 0), { pan: step % 2 ? 0.45 : -0.45 });
        if (step % 4 === 2) api.drum(t, 'hat', 0.3, { open: true, decay: 0.1 });
      } else if (build) {
        const j = (bar - 8) * 16 + step;
        if (j < 30) {
          K.build(api, t, j, 32);
          api.play(t, 'pluck', K.arp(st.arpPool, 'up', g, rng) + (j > 16 ? 1200 : 0), sd, 0.5, { pan: step % 2 ? 0.3 : -0.3 });
        }
      }
    },
  });
})(window.XEN);
