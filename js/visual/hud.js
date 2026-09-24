/* XENOSPHERE — DOM heads-up display. Text lives in the DOM (crisp, cheap,
 * legible over flashing visuals); it only changes when events arrive. */
'use strict';
(function (X) {
  const U = X.U;

  class Hud {
    constructor(doc) {
      const $ = (id) => doc.getElementById(id);
      this.el = {
        root: $('hud'),
        tuningName: $('tuningName'), tuningSub: $('tuningSub'), tuningStat: $('tuningStat'),
        chordBox: $('chordBox'), chordRoot: $('chordRoot'), chordSym: $('chordSym'),
        chordQuality: $('chordQuality'), chordRatio: $('chordRatio'), chordRel: $('chordRel'),
        chordCents: $('chordCents'), chordFn: $('chordFn'),
        cxFill: $('complexityFill'), cxVal: $('complexityVal'),
        secNum: $('secNum'), secTitle: $('secTitle'), secSub: $('secSub'),
        transport: $('transport'), beats: $('beats'), secStat: $('secStat'), timeline: $('timeline'),
      };
      this.reduced = false;
      this.beatDots = [];
      this.segs = [];
      this.secIndex = -1;
    }

    _set(el, text) { if (el && el.textContent !== text) el.textContent = text; }

    section(ev) {
      const e = this.el, m = ev.meta;
      this._set(e.secNum, `${U.roman(ev.index + 1)} / ${U.roman(ev.count)}${ev.cycle ? ` · cycle ${ev.cycle + 1}` : ''}`);
      this._set(e.secTitle, m.title);
      this._set(e.secSub, `${m.tuningLabel} · ${m.subtitle}`);
      if (e.timeline && this.segs.length !== ev.count) {
        e.timeline.textContent = '';
        this.segs = ev.all.map((s, i) => {
          const d = document.createElement('i');
          d.title = `${U.roman(i + 1)} ${s.title}`;
          d.style.flexGrow = String(s.bars);
          e.timeline.appendChild(d);
          return d;
        });
      }
      this.segs.forEach((d, i) => {
        d.classList.toggle('done', i < ev.index);
        d.classList.toggle('on', i === ev.index);
        if (i !== ev.index) d.style.setProperty('--p', i < ev.index ? '1' : '0');
      });
      this.secIndex = ev.index;
      if (e.root) e.root.style.setProperty('--sec', String(m.hue));
    }

    tuning(ev) {
      const e = this.el, tu = ev.tuning;
      this._set(e.tuningName, tu.name);
      this._set(e.tuningSub, tu.subtitle || '');
      this._set(e.tuningStat, ev.stat || '');
    }

    chord(ch) {
      const e = this.el;
      this._set(e.chordRoot, ch.rootName);
      this._set(e.chordSym, ch.sym ? ' ' + ch.sym : '');
      this._set(e.chordQuality, ch.quality || '');
      this._set(e.chordRatio, ch.chordStr ? ch.chordStr.split(':').join(' : ') : '');
      const rel = ch.relStr ? (ch.tuning.kind === 'ed' ? `steps ${ch.relStr} ${ch.relSuffix}` : ch.relStr) : '';
      this._set(e.chordRel, rel);
      let cents = `cents ${ch.centsStr}`;
      if (ch.errors && ch.errors.length) cents += `  ·  err ${ch.errors.map((x) => U.signed(x.error, 1)).join(' ')}`;
      this._set(e.chordCents, cents);
      this._set(e.chordFn, ch.fn || '');
      if (e.chordBox) {
        e.chordBox.style.setProperty('--ch', String(Math.round(ch.hue)));
        if (!this.reduced) {
          e.chordBox.classList.remove('pop');
          void e.chordBox.offsetWidth; // restart the animation
          e.chordBox.classList.add('pop');
        }
      }
      const c = ch.complexity;
      if (e.cxFill) e.cxFill.style.width = c == null ? '100%' : `${Math.min(100, (c / 12) * 100).toFixed(1)}%`;
      this._set(e.cxVal, c == null ? 'n/a (not a ratio chord)' : `${c.toFixed(2)} bits`);
    }

    bar(ev) {
      const e = this.el;
      this._set(e.transport, `bar ${ev.bar + 1}/${ev.bars} · ${Math.round(ev.bpm)} bpm · ${ev.meter.label}`);
      const n = ev.meter.groups.length;
      if (e.beats && this.beatDots.length !== n) {
        e.beats.textContent = '';
        this.beatDots = ev.meter.groups.map((gsize) => {
          const d = document.createElement('i');
          d.style.flexGrow = String(gsize);
          e.beats.appendChild(d);
          return d;
        });
      }
      const seg = this.segs[this.secIndex];
      if (seg) seg.style.setProperty('--p', String((ev.bar + 1) / ev.bars));
    }

    beat(ev) {
      this.beatDots.forEach((d, i) => d.classList.toggle('on', i === ev.group));
    }

    stat(v) { this._set(this.el.secStat, v); }

    setVisible(v) { if (this.el.root) this.el.root.classList.toggle('hidden', !v); }
  }

  X.Hud = Hud;
})(window.XEN);
