/* XENOSPHERE — the conductor.
 * A classic look-ahead scheduler: every tick it asks the current section to
 * schedule all 16th-steps that start before `now + lookahead`. Sections
 * only touch the outside world through `api`, and every api call also emits
 * a timestamped event so the visuals can show exactly what is heard. */
'use strict';
(function (X) {
  const U = X.U, T = X.T, S = X.S;

  const LAYER = { stab: 'chord', keys: 'chord', pad: 'chord', pluck: 'arp', bell: 'arp', lead: 'lead' };

  class Conductor {
    constructor(engine, sections, opts = {}) {
      this.E = engine;
      this.sections = sections;
      this.emit = opts.onEvent || (() => {});
      this.seed = (opts.seed != null ? opts.seed : Math.floor(Math.random() * 4294967296)) >>> 0;
      this.cycle = 0;
      this.lookahead = opts.lookahead || 0.15;
      this.running = false;
      this.bass = new S.Bass(engine);
      this.sec = null;
      this._timer = null;
    }

    start(idx = 0, t0) {
      const t = t0 != null ? t0 : this.E.now + 0.08;
      this.nextTime = t;
      this.running = true;
      this._enter(idx, t, true);
    }

    // Live mode: poll with setInterval. (Offline renders call scheduleUntil.)
    run() {
      if (this._timer) return;
      const tick = () => {
        if (!this.running) return;
        const hidden = typeof document !== 'undefined' && document.hidden;
        this.scheduleUntil(this.E.now + (hidden ? 1.5 : this.lookahead));
      };
      tick();
      this._timer = setInterval(tick, 25);
    }
    halt() {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
    }

    _meta(sec) {
      return {
        id: sec.id, title: sec.title, subtitle: sec.subtitle || '', tuningLabel: sec.tuningLabel || '',
        bars: sec.bars, inset: sec.inset || 'errors', hue: sec.hue || 200,
      };
    }

    _enter(idx, t, first) {
      if (this.sec && this.sec.onExit) this.sec.onExit(this.state, t, this.api);
      this.secIdx = U.mod(idx, this.sections.length);
      this.sec = this.sections[this.secIdx];
      this.bar = 0;
      this.step = 0;
      this.rng = new U.Rng(U.hashSeed(this.seed, this.cycle, this.secIdx));
      this.chord = null;
      this.api = this._makeApi();
      this.emit({
        type: 'section', t, index: this.secIdx, count: this.sections.length,
        meta: this._meta(this.sec), all: this.sections.map((s) => this._meta(s)),
        cycle: this.cycle, seed: this.seed,
      });
      if (!first && this.sec.impact !== false) {
        this.api.fx(t, 'impact', 0.9);
        this.api.drum(t, 'crash', 0.9);
      }
      this.state = this.sec.init ? this.sec.init(this.api, t) || {} : {};
    }

    _beginBar(t) {
      const sec = this.sec;
      this.bpm = sec.bpmAt ? sec.bpmAt(this.bar, this.state) : sec.bpm;
      this.meter = sec.meterAt ? sec.meterAt(this.bar, this.state) : sec.meter;
      this.stepDur = 60 / this.bpm / 4;
      this.groupStarts = new Map();
      let acc = 0;
      this.meter.groups.forEach((g, i) => { this.groupStarts.set(acc, i); acc += g; });
      this.E.setTempo(this.bpm, t);
      this.energy = sec.energyAt ? sec.energyAt(this.bar, this.state) : 0.7;
      this.emit({
        type: 'bar', t, bar: this.bar, bars: sec.bars, bpm: this.bpm, meter: this.meter,
        energy: this.energy, stepDur: this.stepDur, barDur: this.stepDur * this.meter.steps,
      });
      if (sec.onBar) sec.onBar(this.state, this.bar, t, this.api);
    }

    scheduleUntil(horizon) {
      let guard = 0;
      while (this.running && this.nextTime < horizon && guard++ < 2048) {
        const t = this.nextTime;
        if (this.step === 0) this._beginBar(t);
        const g = this.groupStarts.get(this.step);
        if (g != null) this.emit({ type: 'beat', t, group: g, groups: this.meter.groups.length, bar: this.bar });
        this.sec.onStep(this.state, this.bar, this.step, t, this.api);
        this.nextTime += this.stepDur;
        this.step++;
        if (this.step >= this.meter.steps) {
          this.step = 0;
          this.bar++;
          if (this.bar >= this.sec.bars) {
            let next = this.secIdx + 1;
            if (next >= this.sections.length) { next = 0; this.cycle++; }
            this._enter(next, this.nextTime, false);
          }
        }
      }
    }

    // Jump to a section right now (keyboard / buttons).
    jump(idx) {
      const t = this.E.now + 0.05;
      this.nextTime = t;
      this.step = 0;
      this.bass.silence(t);
      this._enter(idx, t, false);
    }

    _makeApi() {
      const self = this, E = this.E;
      return {
        E,
        get rng() { return self.rng; },
        get stepDur() { return self.stepDur; },
        get beatDur() { return self.stepDur * 4; },
        get barDur() { return self.stepDur * self.meter.steps; },
        get bpm() { return self.bpm; },
        get meter() { return self.meter; },
        get cycle() { return self.cycle; },
        get chord() { return self.chord; },
        hz: T.hz,
        setTuning(t, tuning, extra) {
          self.tuning = tuning;
          self.emit(Object.assign({ type: 'tuning', t, tuning, ticks: tuning.ticks(), stat: tuning.statLine() }, extra || {}));
        },
        chord(t, chord) {
          self.chord = chord;
          self.emit({ type: 'chord', t, chord });
        },
        play(t, inst, cents, dur, vel = 0.8, p = {}) {
          const arr = Array.isArray(cents) ? cents : [cents];
          if (typeof S[inst] === 'function') S[inst](E, t, arr.map(T.hz), dur, vel, p);
          self.emit({ type: 'note', t, cents: arr, inst, dur, vel, layer: p.layer || LAYER[inst] || 'arp' });
        },
        drum(t, kind, vel = 1, p = {}) {
          S[kind](E, t, vel, p);
          self.emit({ type: 'drum', t, kind, vel });
        },
        bass(t, cents, dur, vel = 0.9, p = {}) {
          self.bass.note(t, T.hz(cents), dur, vel, p);
          self.emit({ type: 'note', t, cents: [cents], inst: 'bass', dur, vel, layer: 'bass' });
        },
        bassTimbre(t, p) { self.bass.setTimbre(t, p); },
        bassSilence(t) { self.bass.silence(t); },
        fx(t, kind, a, b, c) {
          S[kind](E, t, a, b, c);
          self.emit({ type: 'fx', t, kind, dur: kind === 'riser' || kind === 'sweepDown' ? a : 0 });
        },
        duck(t, depth, release) { E.duck(t, depth, release); },
        text(t, text, style) { self.emit({ type: 'text', t, text, style: style || {} }); },
        stat(t, value) { self.emit({ type: 'stat', t, value }); },
        flash(t, amount = 1, hue) { self.emit({ type: 'flash', t, amount, hue }); },
        glitch(t, amount = 1) { self.emit({ type: 'glitch', t, amount }); },
        event(t, kind, data) { self.emit(Object.assign({ type: kind, t }, data || {})); },
      };
    }
  }

  X.Conductor = Conductor;
})(window.XEN);
