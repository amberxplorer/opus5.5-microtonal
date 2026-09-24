/* XENOSPHERE — chord qualities and chord construction.
 * A chord is defined by the just ratios it *means*. In an equal division the
 * ratios are mapped through the tuning's patent val, so the step pattern,
 * the tempering errors and the beat rates we display are all computed. */
'use strict';
(function (X) {
  const U = X.U, T = X.T;
  const C = {};

  const Q = {
    maj:   { sym: '',     name: 'major triad',          chord: '4:5:6',           ratios: ['1/1', '5/4', '3/2'] },
    min:   { sym: 'm',    name: 'minor triad',          chord: '10:12:15',        ratios: ['1/1', '6/5', '3/2'] },
    maj7:  { sym: 'maj7', name: 'major seventh',        chord: '8:10:12:15',      ratios: ['1/1', '5/4', '3/2', '15/8'] },
    maj9:  { sym: 'maj9', name: 'major ninth',          chord: '8:10:12:15:18',   ratios: ['1/1', '5/4', '3/2', '15/8', '9/4'] },
    m7:    { sym: 'm7',   name: 'minor seventh',        chord: '10:12:15:18',     ratios: ['1/1', '6/5', '3/2', '9/5'] },
    m9:    { sym: 'm9',   name: 'minor ninth',          chord: '20:24:30:36:45',  ratios: ['1/1', '6/5', '3/2', '9/5', '9/4'] },
    dom7:  { sym: '7',    name: 'dominant seventh (5-limit)', chord: '20:25:30:36', ratios: ['1/1', '5/4', '3/2', '9/5'] },
    h7:    { sym: 'h7',   name: 'harmonic seventh',     chord: '4:5:6:7',         ratios: ['1/1', '5/4', '3/2', '7/4'] },
    h9:    { sym: 'h9',   name: 'harmonic ninth',       chord: '4:5:6:7:9',       ratios: ['1/1', '5/4', '3/2', '7/4', '9/4'] },
    h11:   { sym: 'h11',  name: 'harmonic eleventh',    chord: '4:5:6:7:9:11',    ratios: ['1/1', '5/4', '3/2', '7/4', '9/4', '11/4'] },
    h13:   { sym: 'h13',  name: 'harmonic thirteenth',  chord: '4:5:6:7:9:11:13', ratios: ['1/1', '5/4', '3/2', '7/4', '9/4', '11/4', '13/4'] },
    u7:    { sym: 'u7',   name: 'utonal tetrad',        chord: '1/7:1/6:1/5:1/4', ratios: ['1/1', '7/6', '7/5', '7/4'] },
    sm:    { sym: 'sm',   name: 'subminor triad',       chord: '6:7:9',           ratios: ['1/1', '7/6', '3/2'] },
    sm7:   { sym: 'sm7',  name: 'subminor seventh',     chord: '12:14:18:21',     ratios: ['1/1', '7/6', '3/2', '7/4'] },
    SM:    { sym: 'SM',   name: 'supermajor triad',     chord: '14:18:21',        ratios: ['1/1', '9/7', '3/2'] },
    n:     { sym: 'n',    name: 'neutral triad',        chord: '18:22:27',        ratios: ['1/1', '11/9', '3/2'] },
    n7:    { sym: 'n7',   name: 'neutral seventh',      chord: '18:22:27:33',     ratios: ['1/1', '11/9', '3/2', '11/6'] },
    und:   { sym: '(11)', name: 'undecimal tetrad',     chord: '8:10:11:12',      ratios: ['1/1', '5/4', '11/8', '3/2'] },
    pow:   { sym: '5',    name: 'power chord',          chord: '2:3:4',           ratios: ['1/1', '3/2', '2/1'] },
    bpMaj: { sym: '',     name: 'BP major triad',       chord: '3:5:7',           ratios: ['1/1', '5/3', '7/3'] },
    bpMin: { sym: 'm',    name: 'BP minor triad',       chord: '5:7:9',           ratios: ['1/1', '7/5', '9/5'] },
    bp9:   { sym: '9',    name: 'BP tetrad',            chord: '3:5:7:9',         ratios: ['1/1', '5/3', '7/3', '3/1'] },
  };
  C.Q = Q;

  let nextId = 1;

  // Pick the simplest interval in the chord (skipping pure octaves) for the
  // Lissajous figure, and compute its real beat rate from the tuned pitches.
  function lissajousPair(notes, ratios) {
    if (!ratios) return null;
    let best = null;
    for (let i = 0; i < ratios.length; i++) {
      for (let j = i + 1; j < ratios.length; j++) {
        const [a, b] = T.parseRatio(ratios[i]);
        const [c, d] = T.parseRatio(ratios[j]);
        const [n, dd] = T.reduce(c * b, d * a); // r_j / r_i
        if (n <= dd) continue;
        if (Math.log2(n / dd) % 1 === 0) continue; // octave duplicates
        const score = n * dd;
        if (!best || score < best.score) best = { i, j, n, d: dd, score };
      }
    }
    if (!best) return null;
    const fLo = T.hz(notes[best.i].cents), fHi = T.hz(notes[best.j].cents);
    const target = 1200 * Math.log2(best.n / best.d);
    const actual = notes[best.j].cents - notes[best.i].cents;
    return {
      n: best.n, d: best.d, lo: best.i, hi: best.j,
      fLo, fHi, error: actual - target,
      beat: best.d * fHi - best.n * fLo, // coinciding partials d·hi vs n·lo
    };
  }

  function complexity(ratios) {
    if (!ratios || ratios.length < 2) return null;
    let sum = 0, count = 0;
    for (let i = 0; i < ratios.length; i++) {
      for (let j = i + 1; j < ratios.length; j++) {
        const [a, b] = T.parseRatio(ratios[i]);
        const [c, d] = T.parseRatio(ratios[j]);
        sum += T.tenney([c * b, d * a]);
        count++;
      }
    }
    return sum / count;
  }

  /* Build a chord.
   *   tuning: EqualDivision or Just
   *   root:   integer steps (ED) or monzo array (JI)
   *   qKey:   key of Q
   *   extra:  { fn, tags, octave (cents added to every note), rootName } */
  C.make = function (tuning, root, qKey, extra = {}) {
    const q = Q[qKey];
    if (!q) throw new Error('unknown chord quality ' + qKey);
    const shift = extra.octave || 0;
    let notes, relStr, relSuffix, errors = null;
    if (tuning.kind === 'ed') {
      const rel = q.ratios.map((r) => tuning.mapRatio(r));
      notes = rel.map((s) => ({
        steps: root + s,
        cents: (root + s) * tuning.stepCents + shift,
        name: tuning.nameOf(root + s),
      }));
      relStr = rel.join(' · ');
      relSuffix = '\\' + tuning.n + (tuning.isEdo ? '' : 'ed' + tuning.period);
      errors = q.ratios.slice(1).map((r) => ({ ratio: T.ratioStr(r), error: tuning.approx(r).error }));
    } else {
      notes = q.ratios.map((r) => {
        const m = T.monzoAdd(root, T.monzo(r));
        return { monzo: m, cents: tuning.baseCents + T.monzoCents(m) + shift, name: tuning.nameOfMonzo(m) };
      });
      relStr = q.ratios.map((r) => T.ratioStr(r)).join(' · ');
      relSuffix = '';
    }
    return finish({
      tuning, notes, qKey, sym: q.sym, quality: q.name, chordStr: q.chord, ratios: q.ratios,
      rootName: extra.rootName || notes[0].name, relStr, relSuffix, errors,
      fn: extra.fn || '', tags: extra.tags || [],
    });
  };

  /* A chord from explicit pitches (harmonic-series clouds, comma clusters…).
   *   spec: { notes: [{cents, name}], rootName, sym, quality, chordStr, ratios?, relStr? } */
  C.raw = function (tuning, spec) {
    return finish(Object.assign({
      tuning, qKey: 'raw', sym: '', quality: '', chordStr: '', ratios: null,
      relStr: '', relSuffix: '', errors: null, fn: '', tags: [],
    }, spec, { rootName: spec.rootName || spec.notes[0].name }));
  };

  function finish(ch) {
    ch.id = nextId++;
    for (const n of ch.notes) {
      n.pos = ch.tuning.posOfCents(n.cents);
      n.hue = U.hueOfPos(n.pos);
    }
    ch.root = ch.notes[0];
    ch.hue = ch.root.hue;
    const r0 = ch.root.cents;
    ch.centsStr = ch.notes.map((n) => Math.round(n.cents - r0)).join(' · ') + '¢';
    ch.complexity = ch.complexity != null ? ch.complexity : complexity(ch.ratios);
    ch.pair = lissajousPair(ch.notes, ch.ratios);
    ch.label = ch.rootName + (ch.sym ? ' ' + ch.sym : '');
    return ch;
  }

  X.C = C;
})(window.XEN);
