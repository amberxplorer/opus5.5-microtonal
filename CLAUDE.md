# Microtonal Music Demo — "XENOSPHERE"

## Goal
A single-page website that performs a ~3 minute piece of generative,
microtonal electronic music written entirely in JavaScript, then re-seeds and
plays a new variation. The vibe is **hardstyle and happy hardcore**: tuned
distorted kicks, reverse bass, supersaws, hoovers, rave piano, build-ups and
drops. It should sound extreme, dense and exciting, and the visuals should be
driven by the music. Every section lives in a different tuning system, and
the screen explains the theory as it happens ("theory-porn").

Optimise for desktop, but the page must stay usable and legible on phones
(portrait and landscape).

## Inspiration (not a template)
Twitter user @dadabots posted a video
of Opus 5.5 generating music-theory-heavy music in JavaScript, captioned:

> "You can ask Opus 5.5 to write extreme music theory wankery and it will do it
> in javascript. Theory-porn as a genre? everything you see and hear is
> generated from javascript code that claude wrote. no samples, no libraries"

Take the *spirit* of that video, not its layout: black background, bright
flashing colour, chords and tuning shifts labelled legibly in a corner, a
circular note chart in the centre, chords flying towards the viewer with
abstract particles streaming off them. Do **not** copy the video's HUD, wording
or composition verbatim. The owner explicitly wants our own design.

Our own signature elements (keep these distinctive):
- A tuning wheel with N ticks for the active tuning, and faint 12-TET ghost
  ticks so viewers can see how the microtones deviate.
- A Lissajous figure in the centre drawn from the chord's simplest interval.
  It stands still when the interval is pure (JI) and slowly rotates at the
  real beat rate when the interval is tempered.
- Voice-leading arcs on the wheel that show how far each voice moved.
- A context inset (bottom right): patent-val error table, 5-limit lattice,
  or harmonic partial chart, depending on the section.

## Hard constraints
- No audio samples and no external libraries. All sound is synthesized with
  the Web Audio API (noise buffers and reverb impulse responses are generated
  in code); all visuals use Canvas 2D directly.
- The music must be microtonal: tunings outside 12-TET (31-, 19-, 53-, 22-EDO,
  just intonation, Bohlen–Pierce, harmonic series, an EDO roulette). Show the
  active tuning and theory on screen.
- Plain HTML/CSS/JS that runs by opening `index.html` from disk (file://).
  No build step and no ES modules. Every script is a classic script that
  attaches to the global `window.XEN` namespace, loaded in order by
  `index.html`.
- Use only system fonts. Nothing is fetched from the network.

## Accuracy rule (theory labels)
Every number or claim shown on screen must be true. Compute cents, errors,
step counts, vals and names from the tuning math in `js/theory/` instead of
hand-typing numbers. Hand-written flavour text must only state facts that are
verifiable (e.g. "22-EDO tempers out 64/63"). Say "-like" when a label is an
approximation (e.g. "Hicaz-like tetrachord").

## Flashing lights warning (required)
- Show a photosensitivity warning screen before anything plays or flashes.
- Nothing starts until the user clicks "Start". This also satisfies browser
  autoplay rules for audio.
- Offer a reduced-flashing mode, and respect `prefers-reduced-motion` (it
  pre-selects reduced mode). Reduced mode: no full-screen flashes, no glitch
  slices, no camera shake, smoothed brightness changes, fewer flying texts.
- Even in full mode, keep full-screen flashes subtle and never pure red.

## Quality checks
- No console errors on load or during playback.
- Master chain: glue compressor → brick-wall-style limiter → soft clipper, so
  nothing clips painfully.
- Stop (button, Space, Esc) cuts audio instantly: gain goes to 0 at
  `currentTime` and the AudioContext is suspended. Mute (M) keeps the visuals
  running.
- The visuals stay smooth: sprite-based glow (no `shadowBlur`), capped DPR,
  adaptive quality.

## Architecture
```
index.html            markup: canvas, HUD, warning screen, controls
css/style.css
js/core/util.js       XEN.U: RNG, maths, formatting, colour
js/theory/tuning.js   XEN.T: primes/monzos, EqualDivision, Just, naming
js/theory/chords.js   XEN.C: chord qualities and chord construction
js/audio/engine.js    XEN.Engine: master chain, buses, reverb, delay, ducking
js/audio/synths.js    XEN.S: drums, stabs, keys, plucks, bells, leads, bass
js/music/kit.js       XEN.Kit: drum patterns, rolls, voice leading, arps
js/music/sections/*   one file per section (tuning + composition)
js/music/conductor.js XEN.Conductor: look-ahead scheduler, section flow, events
js/visual/*.js        sprites, particles, scene (wheel etc.), inset, HUD
js/main.js            boot, warning screen, controls, keyboard
tools/                Playwright checks and offline audio renders (dev only)
```
Sections talk to the outside world only through the `api` object that the
conductor gives them (`api.play`, `api.drum`, `api.bass`, `api.chord`,
`api.text`, `api.stat`, `api.fx`, `api.duck`, `api.setTuning`). Every call
takes an absolute audio time, and the conductor forwards a matching visual
event so the picture lines up with the sound.

Pitches inside sections are **cents relative to C4 (261.626 Hz)**.

## Testing
Playwright and Chromium are installed globally in the cloud environment:
```
node tools/theory-check.mjs                                 # assertions on on-screen theory facts
NODE_PATH=$(npm root -g) node tools/check.mjs both          # desktop + phone: console errors, screenshots
NODE_PATH=$(npm root -g) node tools/check.mjs reduced       # reduced-motion / reduced-flashing start
NODE_PATH=$(npm root -g) node tools/render-audio.mjs        # offline render per section: levels, spectrograms
NODE_PATH=$(npm root -g) node tools/render-audio.mjs full   # whole piece → WAV + MP3
```
Outputs go to `tools/out/` (git-ignored). Look at the screenshots and
spectrograms before claiming something works. Headless Chromium renders the
canvas in software, so the adaptive quality drops the resolution; use
`index.html?hq=1` for sharp captures. When you add a theory caption, add a
matching assertion to `tools/theory-check.mjs`.

Section lengths are set by `bars`, `bpm`/`bpmAt` and `meter`/`meterAt` in each
section file; `render-audio.mjs` prints every section's duration and the total.
