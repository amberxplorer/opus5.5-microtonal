/* XENOSPHERE — the renderer.
 * Events from the conductor arrive early (they are scheduled ahead of the
 * audio). They wait in a time-sorted queue and are applied when the audio
 * clock reaches them, so every flash, orb and flying chord lands on the
 * sound it belongs to. */
'use strict';
(function (X) {
  const U = X.U, W = X.Wheel, SP = X.Space, I = X.Inset, TAU = U.TAU;

  // Keep full-screen flashes away from saturated red.
  const safeHue = (h) => (h < 25 || h > 335 ? 315 : h);

  class Visuals {
    constructor(canvas, hud, opts = {}) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d', { alpha: false });
      this.hud = hud;
      this.reduced = !!opts.reduced;
      this.motion = opts.motion != null ? opts.motion : 1;
      this.sampleRate = opts.sampleRate || 48000;
      this.quality = 1;
      this.hudVisible = true;
      this.queue = [];
      this.particles = new X.Particles(2400);
      this.particles.setLimit(this.reduced ? 0.4 : 1);

      // scene state
      this.t = 0;
      this.hue = 280; this.targetHue = 280; this.chordHue = 280;
      this.energy = 0.3; this.energyTarget = 0.3;
      this.kick = 0; this.snare = 0; this.flashAmt = 0; this.flashHue = 300;
      this.chordFlash = 0; this.shake = 0; this.glitch = 0;
      this.wheelRot = 0;
      this.tuning = null; this.ticks = []; this.section = null;
      this.chord = null; this.orbs = []; this.arcs = []; this.flares = [];
      this.flyers = []; this.texts = []; this.rings = [];
      this.liss = null; this.lissPhase = 0;
      this.bassAng = -Math.PI / 2; this.bassTarget = 0; this.bassPulse = 0; this.bassHue = 200; this.bassSeen = false;
      this.lattice = { cx: 0, cy: 0, path: [], tri: null, drift: 0 };
      this.partialsActive = new Set();
      this.riser = null; this.riserLevel = 0;
      this.starSpeed = 1;
      this.waveData = null; this.specData = null;

      const NS = 260;
      this.stars = { n: NS, x: new Float32Array(NS), y: new Float32Array(NS), z: new Float32Array(NS), hue: new Float32Array(NS) };
      for (let i = 0; i < NS; i++) this._respawnStar(i, true);

      this._frameTimes = [];
      this.resize();
    }

    // --------------------------------------------------------------- setup
    setReduced(r) {
      this.reduced = r;
      this.particles.setLimit((r ? 0.4 : 1) * this.quality);
      if (this.hud) this.hud.reduced = r;
    }
    setHudVisible(v) {
      this.hudVisible = v;
      if (this.hud) this.hud.setVisible(v);
      this.layout();
    }

    resize() {
      const cw = this.canvas.clientWidth || window.innerWidth;
      const ch = this.canvas.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
      this.u = dpr;
      this.cssW = cw; this.cssH = ch;
      this.w = Math.max(1, Math.round(cw * dpr));
      this.h = Math.max(1, Math.round(ch * dpr));
      if (this.canvas.width !== this.w) this.canvas.width = this.w;
      if (this.canvas.height !== this.h) this.canvas.height = this.h;
      this.layout();
    }

    layout() {
      const cw = this.cssW, ch = this.cssH, u = this.u;
      const narrow = cw < 720;
      const portrait = ch > cw * 1.15;
      let R, cx, cy;
      if (narrow && portrait) {
        R = Math.min(cw * 0.34, ch * 0.22);
        cx = cw * 0.5; cy = ch * 0.6;
      } else if (narrow) {
        R = Math.min(cw * 0.2, ch * 0.3);
        cx = cw * 0.56; cy = ch * 0.55;
      } else {
        R = Math.min(ch * 0.3, cw * 0.24);
        cx = cw * 0.5; cy = ch * 0.53;
      }
      this.R = R * u;
      this.cx0 = cx * u; this.cy0 = cy * u;
      this.cx = this.cx0; this.cy = this.cy0;
      this.Rp = this.R;
      this.narrow = narrow;
      this.showInset = this.hudVisible && cw >= 1000 && ch >= 620;
      this.showLabels = R > 95;
    }

    // Adaptive quality: drop resolution and particle budget when frames are slow.
    adapt(ms) {
      const ft = this._frameTimes;
      ft.push(ms);
      if (ft.length < 90) return;
      const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
      ft.length = 0;
      let q = this.quality;
      if (avg > 24 && q > 0.7) q = Math.max(0.7, q - 0.15);
      else if (avg < 13 && q < 1) q = Math.min(1, q + 0.1);
      if (q !== this.quality) {
        this.quality = q;
        this.particles.setLimit((this.reduced ? 0.4 : 1) * q);
        this.resize();
      }
    }

    // --------------------------------------------------------------- events
    push(ev) {
      const q = this.queue;
      let i = q.length;
      while (i > 0 && q[i - 1].t > ev.t) i--;
      q.splice(i, 0, ev);
    }
    clear() { this.queue.length = 0; }

    _drain(now) {
      const q = this.queue;
      let i = 0;
      while (i < q.length && q[i].t <= now) i++;
      if (!i) return;
      const due = q.splice(0, i);
      for (const ev of due) this.handle(ev, now - ev.t > 0.5);
    }

    handle(ev, stale) {
      switch (ev.type) {
        case 'section':
          this.section = ev.meta;
          if (this.hud) this.hud.section(ev);
          this.lattice.path = [];
          this.partialsActive = new Set();
          if (!stale) {
            this._titleCard(ev);
            this.flash(0.9);
            this._shock(1.1, ev.meta.hue);
          }
          break;
        case 'tuning':
          this.tuning = ev.tuning;
          this.ticks = ev.ticks;
          this.ringN = ev.tuning.kind === 'ed' ? ev.tuning.n : 0;
          if (this.hud) this.hud.tuning(ev);
          break;
        case 'chord': this._chord(ev.chord, stale); break;
        case 'note': this._note(ev, stale); break;
        case 'drum': if (!stale) this._drum(ev); break;
        case 'bar':
          if (this.hud) this.hud.bar(ev);
          this.energyTarget = ev.energy;
          this.beatDur = ev.stepDur * 4;
          break;
        case 'beat':
          if (this.hud) this.hud.beat(ev);
          if (!stale && this.rings.length < 24) {
            this.rings.push({ z: 7.5, hue: this.chordHue, n: this.ringN, spin: Math.random() * TAU, accent: ev.group === 0 ? 1 : 0 });
          }
          break;
        case 'text': if (!stale) this._text(ev.text, ev.style); break;
        case 'stat': if (this.hud) this.hud.stat(ev.value); break;
        case 'fx':
          if (ev.kind === 'riser') this.riser = { start: ev.t, dur: ev.dur };
          else if (ev.kind === 'impact' && !stale) {
            this.riser = null;
            this.flash(1);
            this.shake = Math.max(this.shake, 1);
            this._shock(1.4, this.chordHue);
          } else if (ev.kind === 'sweepDown' && !stale) {
            this.flash(0.4);
          }
          break;
        case 'flash': if (!stale) this.flash(ev.amount, ev.hue); break;
        case 'glitch': if (!stale && !this.reduced) this.glitch = 0.13 * ev.amount + 0.04; break;
        case 'drift': this.lattice.drift = ev.cents; break;
        default: break;
      }
    }

    flash(a, hue) {
      this.flashAmt = Math.min(1.2, this.flashAmt + a);
      this.flashHue = hue != null ? hue : this.chordHue;
    }

    _stepLabel(delta) {
      const tu = this.tuning;
      if (tu && tu.kind === 'ed') {
        const s = delta * tu.n;
        const r = Math.round(s);
        if (Math.abs(s - r) < 0.08) return `${r > 0 ? '+' : U.MINUS}${Math.abs(r)}\\${tu.n}`;
      }
      const period = (tu && tu.periodCents) || 1200;
      return U.fmtCents(delta * period, 1);
    }

    _chord(ch, stale) {
      const prev = this.orbs;
      const orbs = [];
      for (const n of ch.notes) {
        if (!orbs.some((o) => Math.abs(U.circDelta(o.pos, n.pos)) < 0.002)) {
          orbs.push({ pos: n.pos, hue: n.hue, pulse: 1, name: n.name });
        }
      }
      orbs.sort((a, b) => a.pos - b.pos);
      if (prev.length && !stale) {
        for (const o of orbs) {
          let bd = 1;
          for (const p of prev) {
            const d = U.circDelta(p.pos, o.pos);
            if (Math.abs(d) < Math.abs(bd)) bd = d;
          }
          if (Math.abs(bd) > 0.0012 && Math.abs(bd) < 0.2) {
            this.arcs.push({ from: U.mod(o.pos - bd, 1), delta: bd, hue: o.hue, age: 0, life: 1.15, label: this._stepLabel(bd) });
          }
        }
        if (this.arcs.length > 18) this.arcs.splice(0, this.arcs.length - 18);
      }
      this.orbs = orbs;
      this.chord = ch;
      this.targetHue = ch.hue;
      this.chordFlash = 1;
      this.liss = ch.pair ? { n: ch.pair.n, d: ch.pair.d, beat: ch.pair.beat, error: ch.pair.error } : null;
      if (this.hud) this.hud.chord(ch);

      // lattice (JI only)
      const r = ch.root;
      if (r && r.monzo && ch.tuning.kind === 'ji') {
        const L = this.lattice;
        L.path.push([r.monzo[1], r.monzo[2]]);
        if (L.path.length > 40) L.path.shift();
        L.tri = ch.notes.length === 3 ? ch.notes.map((n) => [n.monzo[1], n.monzo[2]]) : null;
        L.tx = r.monzo[1] + r.monzo[2] / 2;
        L.ty = r.monzo[2];
        if (L.path.length === 1) { L.cx = L.tx; L.cy = L.ty; }
      }
      if (ch.tuning.labelMode === 'partial') this.partialsActive = new Set(ch.notes.map((n) => Number(n.name)));

      if (stale) return;
      this.flash(0.5, ch.hue);
      // chord glyph flying toward the viewer
      if (this.flyers.length > 5) this.flyers.shift();
      this.flyers.push({
        verts: orbs.map((o) => o.pos), hue: ch.hue, label: ch.label,
        z: 1, age: 0, life: (this.reduced ? 2.2 : 1.3) / Math.max(0.5, this.motion),
        rot: 0, spin: (Math.random() - 0.5) * (this.reduced ? 0.3 : 1.2),
      });
      // particle bursts from every chord tone
      const n = this.reduced ? 10 : 30;
      for (const o of orbs) {
        const a = W.ang(this, o.pos);
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let k = 0; k < n; k++) {
          const sp = 0.3 + Math.random() * 1.3;
          const sa2 = a + (Math.random() - 0.5) * 1.2;
          this.particles.spawn(ca, sa, 1, Math.cos(sa2) * sp, Math.sin(sa2) * sp, -(0.2 + Math.random() * 1.2),
            0.7 + Math.random() * 1.1, o.hue + (Math.random() - 0.5) * 30, 0.03 + Math.random() * 0.05, 1.4);
        }
      }
    }

    _note(ev, stale) {
      const tu = this.tuning;
      if (!tu) return;
      for (const c of ev.cents) {
        const pos = tu.posOfCents(c);
        const hue = U.hueOfPos(pos);
        if (ev.layer === 'bass') {
          this.bassTarget = pos;
          this.bassPulse = Math.max(this.bassPulse, ev.vel);
          this.bassHue = hue;
          if (!this.bassSeen) this.bassAng = W.ang(this, pos);
          this.bassSeen = true;
        } else if (ev.layer === 'chord') {
          for (const o of this.orbs) {
            if (Math.abs(U.circDelta(o.pos, pos)) < 0.004) o.pulse = Math.max(o.pulse, ev.vel * 0.8);
          }
        } else if (!stale) {
          const lead = ev.layer === 'lead';
          if (this.flares.length > 48) this.flares.shift();
          this.flares.push({ pos, hue, age: 0, life: lead ? 0.5 : 0.32, lead });
          const k = this.reduced ? 1 : lead ? 7 : 2;
          const a = W.ang(this, pos);
          const ca = Math.cos(a), sa = Math.sin(a);
          for (let i = 0; i < k; i++) {
            const sp = 0.4 + Math.random() * 0.9;
            this.particles.spawn(ca * 1.22, sa * 1.22, 1, ca * sp + (Math.random() - 0.5) * 0.3,
              sa * sp + (Math.random() - 0.5) * 0.3, -(Math.random() * 0.8), 0.5 + Math.random() * 0.6, hue, 0.025 + Math.random() * 0.03, 1.8);
          }
        }
      }
    }

    _drum(ev) {
      const red = this.reduced;
      switch (ev.kind) {
        case 'kick':
        case 'hardkick': {
          this.kick = 1;
          if (!red) { this.flash(0.3 * ev.vel); this.shake = Math.max(this.shake, 0.3); }
          const n = red ? 6 : 26;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, sp = 0.5 + Math.random() * 1.1;
            this.particles.spawn(Math.cos(a), Math.sin(a), 1, Math.cos(a) * sp, Math.sin(a) * sp, -0.25,
              0.45 + Math.random() * 0.4, this.chordHue + (Math.random() - 0.5) * 40, 0.028, 2.4);
          }
          break;
        }
        case 'snare':
        case 'clap': {
          this.snare = Math.max(this.snare, ev.vel);
          const n = red ? 2 : Math.round(4 + 8 * ev.vel);
          for (let i = 0; i < n; i++) {
            const r = 0.3 + Math.random() * 1.4, a = Math.random() * TAU;
            this.particles.spawn(Math.cos(a) * r, Math.sin(a) * r, 1 + Math.random() * 0.4, 0, 0, -(0.8 + Math.random()),
              0.35 + Math.random() * 0.3, (this.chordHue + 180) % 360, 0.025, 0.5);
          }
          break;
        }
        case 'crash':
          this.flash(0.5);
          this._shock(0.8, this.chordHue);
          break;
        case 'metal': {
          const n = red ? 1 : 4;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            this.particles.spawn(Math.cos(a) * 1.45, Math.sin(a) * 1.45, 1, 0, 0, -1.2, 0.3, 190, 0.03, 0.5);
          }
          break;
        }
        default: break;
      }
    }

    _shock(strength, hue) {
      const n = Math.round((this.reduced ? 30 : 110) * strength);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const sp = 1.2 + Math.random() * 1.6 * strength;
        this.particles.spawn(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 1, Math.cos(a) * sp, Math.sin(a) * sp,
          -(0.3 + Math.random() * 0.8), 0.8 + Math.random() * 0.8, hue + (Math.random() - 0.5) * 60, 0.035, 1.2);
      }
    }

    _titleCard(ev) {
      const m = ev.meta;
      const z0 = 2.6;
      this.texts.push({ text: `${U.roman(ev.index + 1)} · ${m.title}`, x: 0, y: -0.08, z0, z: z0,
        vz: -0.85 * this.motion * (this.reduced ? 0.6 : 1), yaw: 0, yawSpin: 0, size: this.narrow ? 1.4 : 2.1, hue: m.hue, alpha: 1, age: 0 });
      this.texts.push({ text: m.tuningLabel.toUpperCase(), x: 0, y: 0.16, z0, z: z0,
        vz: -0.85 * this.motion * (this.reduced ? 0.6 : 1), yaw: 0, yawSpin: 0, size: 0.9, hue: (m.hue + 40) % 360, alpha: 0.9, age: 0 });
    }

    _text(text, style) {
      const max = this.reduced ? 4 : 9;
      while (this.texts.length >= max) this.texts.shift();
      const side = Math.random() < 0.5 ? -1 : 1;
      const spread = this.narrow ? [0.15, 0.55] : [0.55, 1.45];
      const z0 = 3.3;
      this.texts.push({
        text, x: side * U.lerp(spread[0], spread[1], Math.random()),
        y: this.narrow ? (Math.random() - 0.5) * 2 : -0.4 + Math.random() * 1.35,
        z0, z: z0, vz: -(1.0 + Math.random() * 0.5) * this.motion * (this.reduced ? 0.55 : 1),
        yaw: -side * (0.25 + Math.random() * 0.55) * (this.reduced ? 0.4 : 1), yawSpin: (Math.random() - 0.5) * 0.25,
        size: (style && style.size) || 1, hue: (this.chordHue + [0, 60, 150, 200][Math.floor(Math.random() * 4)]) % 360,
        alpha: 1, age: 0,
      });
    }

    _respawnStar(i, initial) {
      const st = this.stars;
      let x, y;
      do { x = (Math.random() - 0.5) * 7; y = (Math.random() - 0.5) * 5; } while (Math.abs(x) < 0.35 && Math.abs(y) < 0.35);
      st.x[i] = x; st.y[i] = y;
      st.z[i] = initial ? 0.3 + Math.random() * 9 : 8 + Math.random() * 2;
      st.hue[i] = this.hue + (Math.random() - 0.5) * 80;
    }

    // --------------------------------------------------------------- update
    _update(dt) {
      const red = this.reduced;
      const e = (rate) => Math.exp(-rate * dt);
      this.kick *= e(7);
      this.snare *= e(9);
      this.flashAmt *= e(red ? 20 : 8);
      this.chordFlash *= e(3);
      this.bassPulse *= e(5);
      this.shake *= e(10);
      this.glitch = Math.max(0, this.glitch - dt);
      this.energy = U.approach(this.energy, this.energyTarget, 2, dt);
      this.hue = U.approachHue(this.hue, this.targetHue, red ? 0.8 : 2.2, dt);
      this.chordHue = U.approachHue(this.chordHue, this.targetHue, red ? 2 : 8, dt);
      for (const o of this.orbs) o.pulse *= e(4);

      if (this.liss) {
        const rate = U.clamp(this.liss.beat / this.liss.d, -4, 4);
        this.lissPhase = U.mod(this.lissPhase + TAU * rate * dt, TAU);
      }
      if (this.bassSeen) {
        const target = W.ang(this, this.bassTarget);
        let d = U.mod(target - this.bassAng + Math.PI, TAU) - Math.PI;
        this.bassAng += d * (1 - e(14));
      }
      const L = this.lattice;
      if (L.tx != null) { L.cx = U.approach(L.cx, L.tx, 4, dt); L.cy = U.approach(L.cy, L.ty, 4, dt); }

      // riser: builds star speed until the impact
      if (this.riser) {
        this.riserLevel = U.clamp((this.t - this.riser.start) / this.riser.dur, 0, 1);
        if (this.t > this.riser.start + this.riser.dur + 0.3) this.riser = null;
      } else {
        this.riserLevel *= e(3);
      }
      this.starSpeed = (0.7 + this.energy * 2.2 + this.kick * (red ? 0.3 : 1.6) + this.riserLevel * 4) * this.motion * (red ? 0.6 : 1);

      const st = this.stars;
      for (let i = 0; i < st.n; i++) {
        st.z[i] -= this.starSpeed * dt;
        if (st.z[i] < 0.15) this._respawnStar(i, false);
      }
      const ringSpeed = (1.0 + this.energy * 1.4) * this.motion * (red ? 0.6 : 1);
      for (const r of this.rings) r.z -= ringSpeed * dt;
      this.rings = this.rings.filter((r) => r.z > 0.15);

      for (const a of this.arcs) a.age += dt;
      this.arcs = this.arcs.filter((a) => a.age < a.life);
      for (const f of this.flares) f.age += dt;
      this.flares = this.flares.filter((f) => f.age < f.life);

      for (const f of this.flyers) {
        f.age += dt;
        const k = Math.min(1, f.age / f.life);
        f.z = 1 - 0.86 * U.easeInCubic(k) - 0.1 * k;
        if (!red && f.verts.length > 1) {
          for (const pos of f.verts) {
            const a = pos * TAU - Math.PI / 2 + f.rot + f.spin * f.age + this.wheelRot;
            this.particles.spawn(Math.cos(a) * f.z, Math.sin(a) * f.z, f.z + 0.02,
              Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.25, 0.55, f.hue + (Math.random() - 0.5) * 30, 0.02, 1.5);
          }
        }
      }
      this.flyers = this.flyers.filter((f) => f.age < f.life);

      for (const t of this.texts) { t.age += dt; t.z += t.vz * dt; }
      this.texts = this.texts.filter((t) => t.z > 0.2);

      this.particles.update(dt);
    }

    // ----------------------------------------------------------------- draw
    _draw() {
      const g = this.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      const sk = this.reduced ? 0 : this.shake * 5 * this.u;
      this.cx = this.cx0 + (Math.random() - 0.5) * sk;
      this.cy = this.cy0 + (Math.random() - 0.5) * sk;
      this.Rp = this.R * (1 + (this.reduced ? 0 : 0.03 * this.kick));

      SP.background(this, g);
      SP.tunnel(this, g);
      SP.stars(this, g);
      W.spectrum(this, g);
      W.wave(this, g);
      W.ticks(this, g);
      W.bassRing(this, g);
      W.polygon(this, g);
      W.arcs(this, g);
      W.orbs(this, g);
      W.flares(this, g);
      W.lissajous(this, g);
      this.particles.draw(g, { cx: this.cx, cy: this.cy, R: this.R, w: this.w, h: this.h }, this.reduced ? 0.7 : 1);
      SP.flyers(this, g);
      SP.texts(this, g);
      I.draw(this, g);

      // full-screen flash (disabled in reduced mode)
      if (!this.reduced && this.flashAmt > 0.01) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = U.hsl(safeHue(this.flashHue), 90, 50, Math.min(0.2, this.flashAmt * 0.15));
        g.fillRect(0, 0, this.w, this.h);
      }
      // riser: edges brighten toward the drop
      if (this.riserLevel > 0.02) {
        g.globalCompositeOperation = 'lighter';
        const grd = g.createRadialGradient(this.cx, this.cy, this.R * 0.6, this.cx, this.cy, Math.max(this.w, this.h) * 0.75);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, U.hsl(safeHue(this.hue), 80, 55, (this.reduced ? 0.08 : 0.2) * this.riserLevel));
        g.fillStyle = grd;
        g.fillRect(0, 0, this.w, this.h);
      }
      // glitch slices
      if (this.glitch > 0 && !this.reduced) {
        g.globalCompositeOperation = 'source-over';
        for (let k = 0; k < 6; k++) {
          const y = Math.random() * this.h, sh = (6 + Math.random() * 46) * this.u;
          const dx = (Math.random() - 0.5) * 90 * this.u;
          g.drawImage(this.canvas, 0, y, this.w, sh, dx, y, this.w, sh);
        }
      }
      g.globalCompositeOperation = 'source-over';
    }

    // One frame at audio time `now` (seconds) after `dt` seconds.
    frame(now, dt, probe) {
      this.t = now;
      if (probe) {
        this.waveData = probe.wave();
        this.specData = probe.spec();
        this.sampleRate = probe.sampleRate || this.sampleRate;
      }
      this._drain(now);
      this._update(Math.min(0.05, Math.max(0, dt)));
      this._draw();
    }
  }

  X.Visuals = Visuals;
})(window.XEN);
