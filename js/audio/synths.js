/* XENOSPHERE — instruments. Everything is oscillators, generated noise,
 * filters and envelopes. Polyphonic voices take an array of frequencies (Hz).
 * One-shot voices build their node graph per note and let it be collected
 * after stop(). The bass and the partial drone are persistent. */
'use strict';
(function (X) {
  const S = {};

  function panNode(E, v, dest) {
    const p = E.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, v || 0));
    p.connect(dest);
    return p;
  }
  function shaperTo(E, amount, dest, level = 0.8) {
    const sh = E.ctx.createWaveShaper();
    sh.curve = E.driveCurve(amount);
    const g = E.ctx.createGain();
    g.gain.value = level;
    sh.connect(g);
    g.connect(dest);
    return sh;
  }
  function filter(E, type, freq, q) {
    const f = E.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  }
  const expDecay = (param, t, peak, dur) => {
    param.setValueAtTime(peak, t);
    param.exponentialRampToValueAtTime(Math.max(peak * 0.0008, 0.00001), t + dur);
  };

  // ================================================================ drums
  S.kick = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const dec = p.decay || 0.4;
    const o = c.createOscillator();
    const f0 = p.f0 || 165, f1 = p.f1 || 46;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + (p.pitchDecay || 0.065));
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t + dec * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
    o.connect(g);
    const dest = p.pan ? panNode(E, p.pan, E.drums) : E.drums;
    if (p.drive) g.connect(shaperTo(E, p.drive, dest, 0.75));
    else g.connect(dest);
    o.start(t);
    o.stop(t + dec + 0.02);
    // transient click
    const n = E.noiseSource(t, 0.03);
    const hp = filter(E, 'highpass', 2600);
    const ng = c.createGain();
    expDecay(ng.gain, t, vel * (p.click != null ? p.click : 0.3), 0.014);
    n.connect(hp); hp.connect(ng); ng.connect(dest);
  };

  /* Hardstyle kick: a sine that dives from a click into a tail tuned to the
   * current root (p.tail, Hz), driven hard into a clipper. The tail pitch is
   * part of the harmony, so it follows the tuning like any other note. */
  S.hardkick = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const dec = p.decay || 0.36;
    const tail = p.tail || 55;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(p.f0 || 1100, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.014);
    o.frequency.exponentialRampToValueAtTime(tail * 1.06, t + 0.075);
    o.frequency.linearRampToValueAtTime(tail, t + dec);
    const g = c.createGain();
    g.gain.setValueAtTime(vel * 3.2, t);
    g.gain.setValueAtTime(vel * 3.2, t + dec * 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    const sh = c.createWaveShaper();
    sh.curve = E.driveCurve(p.drive != null ? p.drive : 0.85);
    sh.oversample = '2x';
    const lp = filter(E, 'lowpass', p.cut || 4200, 0.9);
    const post = c.createGain();
    post.gain.value = (p.level || 0.55) * 0.82;
    o.connect(g); g.connect(sh); sh.connect(lp); lp.connect(post); post.connect(E.drums);
    o.start(t);
    o.stop(t + dec + 0.02);
    const n = E.noiseSource(t, 0.03);
    const hp = filter(E, 'highpass', 1800);
    const ng = c.createGain();
    expDecay(ng.gain, t, vel * 0.35, 0.012);
    n.connect(hp); hp.connect(ng); ng.connect(E.drums);
  };

  /* Hardstyle "reverse bass": a distorted tone that swells up through the
   * offbeat and is cut dead just before the next kick. */
  S.revbass = function (E, t, freqs, dur, vel = 0.9, p = {}) {
    const c = E.ctx;
    const hz = freqs[0];
    const g = c.createGain();
    g.gain.setValueAtTime(vel * 0.12, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.9);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const sh = c.createWaveShaper();
    sh.curve = E.driveCurve(p.drive != null ? p.drive : 0.7);
    const lp = filter(E, 'lowpass', 400, 1.5);
    lp.frequency.setValueAtTime(p.cutFrom || 260, t);
    lp.frequency.exponentialRampToValueAtTime(p.cutTo || 2400, t + dur * 0.9);
    const post = c.createGain();
    post.gain.value = p.level || 0.34;
    g.connect(sh); sh.connect(lp); lp.connect(post); post.connect(E.bass);
    [[1, 'sine', 1], [2, 'triangle', 0.35]].forEach(([mult, ty, lvl]) => {
      const o = c.createOscillator();
      o.type = ty;
      o.frequency.value = hz * mult;
      const og = c.createGain();
      og.gain.value = lvl;
      o.connect(og); og.connect(g);
      o.start(t);
      o.stop(t + dur + 0.01);
    });
  };

  S.snare = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const dec = p.decay || 0.17;
    const dest0 = p.pan ? panNode(E, p.pan, E.drums) : E.drums;
    const dest = p.drive ? shaperTo(E, p.drive, dest0, 0.7) : dest0;
    const n = E.noiseSource(t, dec + 0.05);
    const bp = filter(E, 'bandpass', p.tone || 2100, 0.55);
    const hp = filter(E, 'highpass', 480);
    const g = c.createGain();
    expDecay(g.gain, t, vel * 0.75, dec);
    n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(dest);
    const body = c.createOscillator();
    body.type = 'triangle';
    const bf = p.pitch || 188;
    body.frequency.setValueAtTime(bf * 1.4, t);
    body.frequency.exponentialRampToValueAtTime(bf, t + 0.03);
    const bg = c.createGain();
    expDecay(bg.gain, t, vel * 0.6, 0.1);
    body.connect(bg); bg.connect(dest);
    body.start(t);
    body.stop(t + 0.12);
  };

  S.hat = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const dec = p.open ? (p.decay || 0.28) : (p.decay || 0.035);
    const n = E.noiseSource(t, dec + 0.03);
    const hp = filter(E, 'highpass', p.cut || 7200, 0.9);
    const pk = filter(E, 'peaking', p.tone || 10500, 1.2);
    pk.gain.value = 6;
    const g = c.createGain();
    expDecay(g.gain, t, vel * (p.open ? 0.26 : 0.3), dec);
    n.connect(hp); hp.connect(pk); pk.connect(g);
    g.connect(panNode(E, p.pan || 0, E.drums));
  };

  S.clap = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const dec = p.decay || 0.14;
    const n = E.noiseSource(t, dec + 0.08);
    const bp = filter(E, 'bandpass', p.tone || 1250, 1.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    for (const k of [0, 0.011, 0.022]) {
      g.gain.setValueAtTime(vel * 0.7, t + k);
      g.gain.exponentialRampToValueAtTime(vel * 0.06, t + k + 0.0105);
    }
    g.gain.setValueAtTime(vel * 0.55, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.033 + dec);
    n.connect(bp); bp.connect(g); g.connect(panNode(E, p.pan || 0, E.drums));
  };

  S.crash = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const dec = p.decay || 1.7;
    const n = E.noiseSource(t, dec + 0.1);
    const hp = filter(E, 'highpass', 4200, 0.7);
    const g = c.createGain();
    expDecay(g.gain, t, vel * 0.26, dec);
    n.connect(hp); hp.connect(g); g.connect(E.drums);
    g.connect(E.drumVerb);
  };

  // Inharmonic square cluster: metallic hits / industrial ride.
  S.metal = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const dec = p.decay || 0.2;
    const bp = filter(E, 'bandpass', p.tone || 3600, 2.4);
    const hp = filter(E, 'highpass', 1800);
    const g = c.createGain();
    expDecay(g.gain, t, vel * 0.22, dec);
    bp.connect(hp); hp.connect(g); g.connect(panNode(E, p.pan || 0, E.drums));
    const f = p.freq || 520;
    for (const r of [1, 1.4829, 1.9319, 2.5703, 3.1147]) {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = f * r;
      o.connect(bp);
      o.start(t);
      o.stop(t + dec + 0.02);
    }
  };

  S.tom = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const f = p.freq || 130, dec = p.decay || 0.28;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f * 1.7, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g = c.createGain();
    expDecay(g.gain, t, vel * 0.75, dec);
    o.connect(g); g.connect(panNode(E, p.pan || 0, E.drums));
    o.start(t); o.stop(t + dec + 0.02);
  };

  // =============================================================== fx
  S.impact = function (E, t, vel = 1, p = {}) {
    const c = E.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(p.f0 || 120, t);
    o.frequency.exponentialRampToValueAtTime(p.f1 || 28, t + 1.2);
    const g = c.createGain();
    expDecay(g.gain, t, vel * 0.85, p.decay || 2.2);
    o.connect(g); g.connect(E.fx);
    o.start(t); o.stop(t + (p.decay || 2.2) + 0.05);
    const n = E.noiseSource(t, 1.3);
    const lp = filter(E, 'lowpass', 2200, 0.5);
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 1.1);
    const ng = c.createGain();
    expDecay(ng.gain, t, vel * 0.5, 1.2);
    n.connect(lp); lp.connect(ng); ng.connect(E.fx);
  };

  S.riser = function (E, t, dur, vel = 1, p = {}) {
    const c = E.ctx;
    const n = E.noiseSource(t, dur + 0.05);
    const bp = filter(E, 'bandpass', 400, 2.5);
    bp.frequency.setValueAtTime(p.from || 320, t);
    bp.frequency.exponentialRampToValueAtTime(p.to || 9000, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.32, t + dur);
    g.gain.setValueAtTime(0, t + dur + 0.005);
    n.connect(bp); bp.connect(g); g.connect(E.fx);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(p.pitchFrom || 160, t);
    o.frequency.exponentialRampToValueAtTime(p.pitchTo || 1500, t + dur);
    const lp = filter(E, 'lowpass', 2600, 3);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(vel * 0.05, t + dur);
    og.gain.setValueAtTime(0, t + dur + 0.005);
    o.connect(lp); lp.connect(og); og.connect(E.fx);
    o.start(t); o.stop(t + dur + 0.02);
  };

  // Reverse-swell noise that dives down (used on tuning changes).
  S.sweepDown = function (E, t, dur, vel = 1) {
    const c = E.ctx;
    const n = E.noiseSource(t, dur + 0.05);
    const bp = filter(E, 'bandpass', 6000, 3);
    bp.frequency.setValueAtTime(7000, t);
    bp.frequency.exponentialRampToValueAtTime(250, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vel * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    n.connect(bp); bp.connect(g); g.connect(E.fx);
  };

  // ============================================================ tonal voices
  // Supersaw-style stab: three detuned oscillators per note, spread L/C/R.
  S.stab = function (E, t, freqs, dur, vel = 0.8, p = {}) {
    const c = E.ctx;
    const amp = c.createGain();
    const peak = (vel * (p.gain || 0.2)) / Math.sqrt(freqs.length);
    const att = p.attack || 0.004, rel = p.release || 0.08;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + att);
    amp.gain.setTargetAtTime(peak * (p.sustain != null ? p.sustain : 0.55), t + att, p.decay || 0.12);
    amp.gain.setTargetAtTime(0, t + dur, rel);
    const f = filter(E, 'lowpass', p.cutHi || 5200, p.q || 1.4);
    f.frequency.setValueAtTime(p.cutHi || 5200, t);
    f.frequency.setTargetAtTime(p.cutLo || 900, t, p.fdecay || 0.09);
    f.connect(amp);
    amp.connect(p.dest || E.musicDuck);
    const panL = panNode(E, -0.6, f), panR = panNode(E, 0.6, f);
    const spread = p.spread != null ? p.spread : 14;
    const voices = E.lite ? Math.min(p.voices || 3, 3) : p.voices || 3;
    const end = t + dur + rel * 6;
    for (const hz of freqs) {
      for (let v = 0; v < voices; v++) {
        const k = voices > 1 ? (v / (voices - 1)) * 2 - 1 : 0; // -1..1
        const o = c.createOscillator();
        if (p.wave) o.setPeriodicWave(p.wave);
        else o.type = p.type || 'sawtooth';
        if (p.bend) {
          // hoover-style scoop into the note
          o.frequency.setValueAtTime(hz * Math.pow(2, p.bend / 1200), t);
          o.frequency.exponentialRampToValueAtTime(hz, t + (p.bendTime || 0.09));
        } else {
          o.frequency.value = hz;
        }
        o.detune.value = k * spread + (Math.random() - 0.5) * 4;
        o.connect(k < -0.2 ? panL : k > 0.2 ? panR : f);
        o.start(t);
        o.stop(end);
      }
    }
  };

  // Two-operator FM electric piano.
  S.keys = function (E, t, freqs, dur, vel = 0.8, p = {}) {
    const c = E.ctx;
    const n = freqs.length;
    const peak = (vel * (p.gain || 0.22)) / Math.sqrt(n);
    const rel = p.release || 0.3;
    const end = t + dur + rel * 5;
    freqs.forEach((hz, i) => {
      const car = c.createOscillator();
      car.frequency.value = hz;
      const mod = c.createOscillator();
      mod.frequency.value = hz * (p.ratio || 1);
      const mg = c.createGain();
      const idx = (p.index || 2.0) * hz;
      mg.gain.setValueAtTime(idx, t);
      mg.gain.setTargetAtTime(idx * 0.12, t, p.idxDecay || 0.22);
      mod.connect(mg); mg.connect(car.frequency);
      const a = c.createGain();
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(peak, t + 0.004);
      a.gain.setTargetAtTime(peak * 0.35, t + 0.004, p.decay || 0.5);
      a.gain.setTargetAtTime(0, t + dur, rel);
      car.connect(a);
      a.connect(panNode(E, n > 1 ? (i / (n - 1) - 0.5) * 0.9 : (p.pan || 0), p.dest || E.musicDuck));
      car.start(t); mod.start(t);
      car.stop(end); mod.stop(end);
    });
  };

  // Inharmonic FM bell.
  S.bell = function (E, t, freqs, dur, vel = 0.8, p = {}) {
    const c = E.ctx;
    const peak = (vel * (p.gain || 0.14)) / Math.sqrt(freqs.length);
    const dec = p.decay || 1.2;
    freqs.forEach((hz) => {
      const car = c.createOscillator();
      car.frequency.value = hz;
      const mod = c.createOscillator();
      mod.frequency.value = hz * (p.ratio || 3.5);
      const mg = c.createGain();
      const idx = (p.index || 1.6) * hz;
      mg.gain.setValueAtTime(idx, t);
      mg.gain.exponentialRampToValueAtTime(idx * 0.05, t + dec * 0.8);
      mod.connect(mg); mg.connect(car.frequency);
      const a = c.createGain();
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(peak, t + 0.002);
      a.gain.exponentialRampToValueAtTime(peak * 0.001, t + dec);
      car.connect(a);
      a.connect(panNode(E, p.pan || 0, p.dest || E.musicDuck));
      car.start(t); mod.start(t);
      car.stop(t + dec + 0.02); mod.stop(t + dec + 0.02);
    });
  };

  // Bright filtered pluck for arpeggios.
  S.pluck = function (E, t, freqs, dur, vel = 0.8, p = {}) {
    const c = E.ctx;
    const peak = (vel * (p.gain || 0.12)) / Math.sqrt(freqs.length);
    const dec = Math.max(0.06, p.decay || dur * 1.6);
    freqs.forEach((hz) => {
      const f = filter(E, 'lowpass', hz * 8, p.q || 5);
      f.frequency.setValueAtTime(Math.min(hz * (p.bright || 10), 16000), t);
      f.frequency.setTargetAtTime(hz * 1.3, t, p.fdecay || 0.05);
      const a = c.createGain();
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(peak, t + 0.002);
      a.gain.exponentialRampToValueAtTime(peak * 0.001, t + dec);
      f.connect(a);
      a.connect(panNode(E, p.pan || 0, p.dest || E.musicDuck));
      let types = p.wave ? ['custom', 'custom'] : ['sawtooth', 'square'];
      if (E.lite) types = types.slice(0, 1);
      types.forEach((ty, k) => {
        const o = c.createOscillator();
        if (ty === 'custom') o.setPeriodicWave(p.wave);
        else o.type = ty;
        o.frequency.value = hz;
        o.detune.value = k ? 7 : -7;
        o.connect(f);
        o.start(t);
        o.stop(t + dec + 0.02);
      });
    });
  };

  // Monophonic lead with delayed vibrato and optional glide (cents-linear).
  S.lead = function (E, t, freqs, dur, vel = 0.8, p = {}) {
    const c = E.ctx;
    const hz = freqs[0];
    const peak = vel * (p.gain || 0.16);
    const rel = p.release || 0.09;
    const end = t + dur + rel * 6;
    const f = filter(E, 'lowpass', p.cut || 2600, p.q || 2);
    const a = c.createGain();
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(peak, t + (p.attack || 0.01));
    a.gain.setTargetAtTime(peak * 0.8, t + 0.02, 0.2);
    a.gain.setTargetAtTime(0, t + dur, rel);
    f.connect(a);
    a.connect(panNode(E, p.pan || 0, p.dest || E.lead));
    const lfo = c.createOscillator();
    lfo.frequency.value = p.vibRate || 5.6;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(hz * (p.vib != null ? p.vib : 0.007), t + Math.min(0.3, dur * 0.6));
    lfo.connect(lg);
    const types = p.wave ? ['custom'] : p.sub === false ? [p.type || 'sawtooth'] : [p.type || 'sawtooth', 'square'];
    types.forEach((ty, k) => {
      const o = c.createOscillator();
      if (ty === 'custom') o.setPeriodicWave(p.wave);
      else o.type = ty;
      if (p.from) {
        o.frequency.setValueAtTime(p.from, t);
        o.frequency.exponentialRampToValueAtTime(hz, t + (p.glide || 0.08));
      } else {
        o.frequency.setValueAtTime(hz, t);
      }
      o.detune.value = k ? -1200 : 0; // second osc an octave down for weight
      lg.connect(o.frequency);
      const og = c.createGain();
      og.gain.value = k ? 0.45 : 1;
      o.connect(og); og.connect(f);
      o.start(t); o.stop(end);
    });
    lfo.start(t); lfo.stop(end);
  };

  // Slow pad: two detuned saws + a sub triangle per note.
  S.pad = function (E, t, freqs, dur, vel = 0.6, p = {}) {
    const c = E.ctx;
    const peak = (vel * (p.gain || 0.12)) / Math.sqrt(freqs.length);
    const att = p.attack || 0.4, rel = p.release || 1.0;
    const end = t + dur + rel * 5;
    const f = filter(E, 'lowpass', p.cut || 1500, 0.8);
    f.frequency.setValueAtTime((p.cut || 1500) * 0.5, t);
    f.frequency.linearRampToValueAtTime(p.cut || 1500, t + att + 0.2);
    const a = c.createGain();
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(peak, t + att);
    a.gain.setTargetAtTime(0, t + dur, rel);
    f.connect(a);
    a.connect(p.dest || E.musicDuck);
    const panL = panNode(E, -0.7, f), panR = panNode(E, 0.7, f);
    const layers = [[-9, panL, 'sawtooth'], [9, panR, 'sawtooth'], [0, f, 'triangle']];
    for (const hz of freqs) {
      (E.lite ? layers.slice(0, 2) : layers).forEach(([dt, dst, ty]) => {
        const o = c.createOscillator();
        if (p.wave && ty === 'sawtooth') o.setPeriodicWave(p.wave);
        else o.type = ty;
        o.frequency.value = hz;
        o.detune.value = dt;
        o.connect(dst);
        o.start(t);
        o.stop(end);
      });
    }
  };

  // ============================================================ persistent
  class Bass {
    constructor(E) {
      const c = E.ctx;
      this.E = E;
      const osc = (type) => { const o = c.createOscillator(); o.type = type; o.frequency.value = 55; return o; };
      const gain = (v) => { const g = c.createGain(); g.gain.value = v; return g; };
      this.saw1 = osc('sawtooth');
      this.saw2 = osc('sawtooth');
      this.sq = osc('square');
      this.sub = osc('sine');
      this.saw1.detune.value = -11;
      this.saw2.detune.value = 11;
      this.gSaw = gain(0.5);
      this.gSq = gain(0);
      this.gSub = gain(0.85);
      this.filter = c.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 400;
      this.filter.Q.value = 5;
      this.shaper = c.createWaveShaper();
      this.shaper.curve = E.driveCurve(0.35);
      this.post = gain(0.5);
      this.amp = gain(0);
      this.saw1.connect(this.gSaw); this.saw2.connect(this.gSaw);
      this.sq.connect(this.gSq);
      this.gSaw.connect(this.filter); this.gSq.connect(this.filter);
      this.filter.connect(this.shaper); this.shaper.connect(this.post); this.post.connect(this.amp);
      this.sub.connect(this.gSub); this.gSub.connect(this.amp);
      this.amp.connect(E.bassDuck);
      this.lfo = osc('sine');
      this.lfo.frequency.value = 0.35;
      this.lfoGain = gain(160);
      this.lfo.connect(this.lfoGain); this.lfoGain.connect(this.filter.frequency);
      this.cutoff = 420;
      this.envAmt = 5;
      this.subOct = false;
      const t0 = c.currentTime;
      for (const o of [this.saw1, this.saw2, this.sq, this.sub, this.lfo]) o.start(t0);
    }
    setTimbre(t, p) {
      const set = (param, v) => { if (v != null) param.setTargetAtTime(v, t, 0.04); };
      set(this.gSaw.gain, p.saw);
      set(this.gSq.gain, p.sq);
      set(this.gSub.gain, p.sub);
      set(this.filter.Q, p.q);
      set(this.lfo.frequency, p.lfoRate);
      set(this.lfoGain.gain, p.lfoDepth);
      set(this.post.gain, p.level);
      if (p.detune != null) {
        this.saw1.detune.setTargetAtTime(-p.detune, t, 0.05);
        this.saw2.detune.setTargetAtTime(p.detune, t, 0.05);
      }
      if (p.cutoff != null) this.cutoff = p.cutoff;
      if (p.env != null) this.envAmt = p.env;
      if (p.subOct != null) this.subOct = p.subOct;
      if (p.drive != null) this.shaper.curve = this.E.driveCurve(p.drive);
    }
    _freq(param, hz, t, glide) {
      param.cancelScheduledValues(t);
      if (glide > 0) param.setTargetAtTime(hz, t, glide / 3);
      else param.setValueAtTime(hz, t);
    }
    note(t, hz, dur, vel = 0.9, p = {}) {
      const glide = p.glide || 0;
      for (const o of [this.saw1, this.saw2, this.sq]) this._freq(o.frequency, hz, t, glide);
      this._freq(this.sub.frequency, this.subOct ? hz / 2 : hz, t, glide);
      const a = this.amp.gain;
      a.cancelScheduledValues(t);
      a.setTargetAtTime(vel, t, 0.003);
      a.setTargetAtTime(vel * (p.sustain != null ? p.sustain : 0.85), t + 0.04, 0.25);
      a.setTargetAtTime(0, t + dur, p.release || 0.035);
      const f = this.filter.frequency;
      f.cancelScheduledValues(t);
      f.setTargetAtTime(Math.min(this.cutoff * (p.env || this.envAmt), 9000), t, 0.002);
      f.setTargetAtTime(this.cutoff, t + 0.012, p.fdecay || 0.11);
    }
    silence(t) {
      const a = this.amp.gain;
      a.cancelScheduledValues(t);
      a.setTargetAtTime(0, t, 0.05);
    }
    dispose(t) {
      this.silence(t);
      for (const o of [this.saw1, this.saw2, this.sq, this.sub, this.lfo]) o.stop(t + 0.5);
    }
  }
  S.Bass = Bass;

  // Additive harmonic-series drone: partial k is an exact integer multiple.
  class PartialDrone {
    constructor(E, f0, count, dest) {
      const c = E.ctx;
      this.oscs = [];
      this.gains = [];
      const t0 = c.currentTime;
      for (let k = 1; k <= count; k++) {
        const o = c.createOscillator();
        o.frequency.value = f0 * k;
        const g = c.createGain();
        g.gain.value = 0;
        const pan = c.createStereoPanner();
        pan.pan.value = k === 1 ? 0 : ((k % 2 ? 1 : -1) * Math.min(0.8, 0.15 + k * 0.03));
        o.connect(g); g.connect(pan); pan.connect(dest || E.musicDuck);
        o.start(t0);
        this.oscs.push(o);
        this.gains.push(g);
      }
    }
    set(k, t, g, tc = 0.6) {
      const gg = this.gains[k - 1];
      if (gg) gg.gain.setTargetAtTime(g, t, tc);
    }
    stop(t, fade = 1.5) {
      for (const g of this.gains) g.gain.setTargetAtTime(0, t, fade / 4);
      for (const o of this.oscs) o.stop(t + fade + 0.2);
    }
  }
  S.PartialDrone = PartialDrone;

  X.S = S;
})(window.XEN);
