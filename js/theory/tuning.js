/* XENOSPHERE — tuning maths.
 * Primes, monzos (prime-exponent vectors), patent vals, note naming for
 * equal divisions (ups-and-downs), Bohlen–Pierce and just intonation (HEJI-lite).
 * All on-screen theory numbers are computed from here. */
'use strict';
(function (X) {
  const U = X.U;
  const T = {};

  const PRIMES = [2, 3, 5, 7, 11, 13];
  const PRIME_CENTS = PRIMES.map((p) => 1200 * Math.log2(p));
  const REF_HZ = 261.6255653005986; // C4, 12-TET at A4 = 440 Hz
  T.PRIMES = PRIMES;
  T.REF_HZ = REF_HZ;
  T.hz = (cents) => REF_HZ * Math.pow(2, cents / 1200);

  // ------------------------------------------------------------- ratios
  function parseRatio(r) {
    if (Array.isArray(r)) return [r[0], r[1]];
    if (typeof r === 'number') return [r, 1];
    const parts = String(r).split('/');
    return [Number(parts[0]), Number(parts[1] || 1)];
  }
  function reduce(n, d) {
    const g = U.gcd(n, d);
    return [n / g, d / g];
  }
  function factor(n) {
    const e = PRIMES.map(() => 0);
    for (let i = 0; i < PRIMES.length; i++) {
      while (n % PRIMES[i] === 0) { n /= PRIMES[i]; e[i]++; }
    }
    if (n !== 1) throw new Error('ratio outside the 13-limit');
    return e;
  }
  const monzo = (r) => {
    const [n, d] = parseRatio(r);
    const a = factor(n), b = factor(d);
    return a.map((v, i) => v - b[i]);
  };
  const monzoCents = (m) => m.reduce((s, v, i) => s + v * PRIME_CENTS[i], 0);
  const monzoAdd = (a, b) => a.map((v, i) => v + (b[i] || 0));
  const monzoScale = (a, k) => a.map((v) => v * k);
  const ratioCents = (r) => {
    const [n, d] = parseRatio(r);
    return 1200 * Math.log2(n / d);
  };
  function monzoRatio(m) {
    let n = 1, d = 1;
    m.forEach((e, i) => {
      if (e > 0) n *= Math.pow(PRIMES[i], e);
      else if (e < 0) d *= Math.pow(PRIMES[i], -e);
    });
    return [n, d];
  }
  const ratioStr = (r) => {
    const [n, d] = reduce(...parseRatio(r));
    return `${n}/${d}`;
  };
  // Tenney height in bits: log2(n·d) of the reduced ratio.
  const tenney = (r) => {
    const [n, d] = reduce(...parseRatio(r));
    return Math.log2(n * d);
  };
  Object.assign(T, { parseRatio, reduce, factor, monzo, monzoCents, monzoAdd, monzoScale,
    ratioCents, monzoRatio, ratioStr, tenney });

  // ------------------------------------------------------------- naming
  const FIFTHS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const SHARP = '♯', FLAT = '♭';
  const UP = '↑', DOWN = '↓';
  function accidental(a) {
    if (!a) return '';
    return (a > 0 ? SHARP : FLAT).repeat(Math.min(Math.abs(a), 3));
  }
  function arrows(u) {
    if (!u) return '';
    const ch = u > 0 ? UP : DOWN;
    const n = Math.abs(u);
    return n <= 3 ? ch.repeat(n) : ch + U.superscript(n);
  }
  // Letter name for a stack of k just/Pythagorean fifths above C.
  function pythagoreanName(k) {
    const idx = k + 1;
    return FIFTHS[U.mod(idx, 7)] + accidental(Math.floor(idx / 7));
  }
  // Ups-and-downs notation for any EDO: naturals from the chain of fifths,
  // sharps/flats from the EDO's own sharp size, arrows for what's left over.
  function upDownNames(n, preferFlats) {
    const fifth = Math.round(n * Math.log2(1.5));
    const sharp = 7 * fifth - 4 * n;
    const nat = {};
    FIFTHS.forEach((L, i) => { nat[L] = U.mod((i - 1) * fifth, n); });
    const out = [];
    for (let s = 0; s < n; s++) {
      let best = String(s), bestScore = Infinity;
      for (const L of 'CDEFGAB') {
        for (let a = -2; a <= 2; a++) {
          if (a !== 0 && sharp === 0) continue;
          let u = U.mod(s - nat[L] - a * sharp, n);
          if (u > n / 2) u -= n;
          if (Math.abs(u) > 3) continue;
          let score = Math.abs(a) + Math.abs(u) * 1.25 + (Math.abs(a) === 2 ? 0.6 : 0);
          if (a > 0 && preferFlats) score += 0.1;
          if (a < 0 && !preferFlats) score += 0.1;
          if (score < bestScore) { bestScore = score; best = arrows(u) + L + accidental(a); }
        }
      }
      out.push(best);
    }
    return out;
  }
  // HEJI-lite: 5-limit notes get Pythagorean letters plus one syntonic-comma
  // arrow per factor of 5 (5/4 = "E↓"). Higher primes fall back to cents.
  function jiName(m) {
    const e3 = m[1] || 0, e5 = m[2] || 0;
    if (m[3] || m[4] || m[5]) return null;
    return pythagoreanName(e3 + 4 * e5) + arrows(-e5);
  }
  const NAMES12 = ['C', 'C' + SHARP, 'D', 'E' + FLAT, 'E', 'F', 'F' + SHARP, 'G', 'A' + FLAT, 'A', 'B' + FLAT, 'B'];
  // Nearest 12-TET name plus deviation, e.g. "B♭−31¢".
  function centsName(c) {
    const semis = Math.round(c / 100);
    const dev = c - semis * 100;
    const base = NAMES12[U.mod(semis, 12)];
    return Math.abs(dev) < 0.5 ? base : base + U.signed(dev, 0) + '¢';
  }
  // How many letter names a just ratio spans (5/4 → 2: a third; 7/4 → 6:
  // a seventh), using the same fifth-mapping as the HEJI names above.
  function letterSteps(r) {
    const m = monzo(r);
    const k = m[1] + 4 * m[2] - 2 * m[3] - m[4] - 4 * m[5];
    return U.mod(4 * k, 7);
  }
  Object.assign(T, { pythagoreanName, upDownNames, jiName, centsName, arrows, accidental, letterSteps,
    SHARP, FLAT, UP, DOWN, NAMES12 });

  // Bohlen–Pierce nine-note Lambda-mode naturals plus chromatic steps.
  const BP_NAMES = ['C', 'D' + FLAT, 'D', 'E', 'F', 'G' + FLAT, 'G', 'H', 'J' + FLAT, 'J', 'A', 'B' + FLAT, 'B'];

  // Facts per EDO that we are sure of; everything else is computed.
  const EDO_SUBTITLES = {
    5: 'equipentatonic',
    7: 'equiheptatonic',
    10: 'two interleaved 5-EDOs',
    12: 'the default tuning',
    15: 'tempers out 256/243 (blackwood)',
    17: 'sharp fifths, neutral thirds',
    19: 'near ⅓-comma meantone',
    22: 'superpyth · porcupine · pajara',
    24: 'quarter-tones',
    26: 'flat fifths, good 7th harmonic',
    27: 'superpyth: tempers out 64/63',
    31: 'septimal meantone (Huygens, Fokker)',
    34: 'tempers out the kleisma 15625/15552',
    41: 'near-pure fifths',
    46: 'slightly sharp fifths',
    53: 'Mercator · Holdrian commas',
    72: 'twelfth-tones',
  };

  // ------------------------------------------------------ equal divisions
  class EqualDivision {
    constructor(n, opts = {}) {
      this.kind = 'ed';
      this.n = n;
      this.period = opts.period || 2;
      this.periodCents = 1200 * Math.log2(this.period);
      this.stepCents = this.periodCents / n;
      const lp = Math.log2(this.period);
      this.val = PRIMES.map((p) => Math.round((n * Math.log2(p)) / lp));
      this.isEdo = this.period === 2;
      this.id = opts.id || (this.isEdo ? `${n}edo` : `${n}ed${this.period}`);
      this.name = opts.name || (this.isEdo ? `${n}-EDO` : `${n}-ED${this.period}`);
      this.subtitle = opts.subtitle || (this.isEdo ? EDO_SUBTITLES[n] : '') || '';
      this.names = opts.names || (this.isEdo ? upDownNames(n, opts.preferFlats) : BP_NAMES);
      this.refRatios = opts.refRatios ||
        (this.isEdo ? ['3/2', '5/4', '7/4', '11/8', '13/8', '6/5', '7/6', '9/8'] : ['5/3', '7/3', '7/5', '9/7', '9/5', '15/7']);
      this.fifthSteps = Math.round(n * Math.log2(1.5));
      this.sharpSteps = 7 * this.fifthSteps - 4 * n;
      this.valPrimes = this.isEdo ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];
    }
    mapRatio(r) {
      const m = monzo(r);
      return m.reduce((s, v, i) => s + v * this.val[i], 0);
    }
    cents(steps) { return steps * this.stepCents; }
    nameOf(steps) {
      const i = U.mod(Math.round(steps), this.n);
      return this.names[i] || String(i);
    }
    // Spell a pitch on a given letter (chord spelling): the fewest
    // sharps/flats and arrows that reach `steps` from that natural.
    spell(steps, letter) {
      if (!this.isEdo) return this.nameOf(steps);
      const n = this.n, sharp = this.sharpSteps;
      const nat = U.mod((FIFTHS.indexOf(letter) - 1) * this.fifthSteps, n);
      const s = U.mod(Math.round(steps), n);
      // When the sharp is a single step (12-, 19-EDO…) arrows are redundant.
      const maxU = Math.abs(sharp) === 1 ? 0 : 4;
      let best = null, bestScore = Infinity;
      for (let a = -3; a <= 3; a++) {
        if (a !== 0 && sharp === 0) continue;
        let u = U.mod(s - nat - a * sharp, n);
        if (u > n / 2) u -= n;
        if (Math.abs(u) > maxU) continue;
        const score = Math.abs(a) + Math.abs(u) * 1.25 + [0, 0, 0.6, 1.5][Math.abs(a)];
        if (score < bestScore) { bestScore = score; best = arrows(u) + letter + accidental(a); }
      }
      return best || this.nameOf(steps);
    }
    posOfCents(c) { return U.mod(c, this.periodCents) / this.periodCents; }
    approx(r) {
      const steps = this.mapRatio(r);
      const target = ratioCents(r);
      const cents = steps * this.stepCents;
      return { ratio: ratioStr(r), steps, cents, target, error: cents - target };
    }
    valString() {
      return '⟨' + this.valPrimes.map((i) => this.val[i]).join(' ') + ']';
    }
    valPrimeString() { return this.valPrimes.map((i) => PRIMES[i]).join('.'); }
    ticks() {
      const t = [];
      for (let i = 0; i < this.n; i++) {
        const name = this.names[i] || String(i);
        const natural = /^[A-J]$/.test(name);
        t.push({ pos: i / this.n, label: name, major: natural, index: i });
      }
      return t;
    }
    statLine() {
      const parts = [`step ${this.stepCents.toFixed(3)}¢`];
      const refs = this.isEdo ? ['3/2', '5/4', '7/4'] : ['5/3', '7/3', '9/7'];
      for (const r of refs) parts.push(`${r} ${U.fmtCents(this.approx(r).error, 2)}`);
      if (!this.isEdo) parts.push(`period ${this.period}/1 = ${this.periodCents.toFixed(2)}¢`);
      return parts.join(' · ');
    }
  }
  T.EqualDivision = EqualDivision;
  T.edo = (n, opts) => new EqualDivision(n, opts);
  T.bp = () => new EqualDivision(13, {
    period: 3, id: 'bp', name: 'Bohlen–Pierce', subtitle: '13 equal steps of the tritave 3/1',
  });

  // -------------------------------------------------------- just intonation
  class Just {
    constructor(opts = {}) {
      this.kind = 'ji';
      this.period = 2;
      this.periodCents = 1200;
      this.id = opts.id || 'ji';
      this.name = opts.name || 'Just intonation';
      this.subtitle = opts.subtitle || '';
      this.baseCents = opts.baseCents || 0; // where 1/1 sits, in cents from C4
      this.labelMode = opts.labelMode || 'heji';
      this.refRatios = opts.refRatios || ['3/2', '5/4', '6/5', '81/80', '128/125'];
      this.tickSet = opts.ticks || [];
      this.stat = opts.stat || 'pure ratios · zero tempering error';
    }
    nameOfMonzo(m) {
      if (this.labelMode === 'partial') return String(monzoRatio(m)[0] / monzoRatio(m)[1]);
      return jiName(m) || centsName(this.baseCents + monzoCents(m));
    }
    posOfCents(c) { return U.mod(c, 1200) / 1200; }
    approx(r) {
      const target = ratioCents(r);
      return { ratio: ratioStr(r), steps: null, cents: target, target, error: 0 };
    }
    setTicks(list) { this.tickSet = list; }
    ticks() {
      return this.tickSet.map((t) => ({ pos: this.posOfCents(t.cents), label: t.label, major: !!t.major }));
    }
    statLine() { return this.stat; }
  }
  T.Just = Just;

  X.T = T;
})(window.XEN);
