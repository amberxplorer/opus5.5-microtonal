# Microtonal Music Demo

## Goal
Build a single-page website that shows off generative, microtonal electronic
music written entirely in JavaScript. It should sound extreme, dense, and
exciting, with visuals driven by the music.

## Inspiration
Twitter user @dadabots posted a video
of Opus 5.5 generating music-theory-heavy music in JavaScript, captioned:

> "You can ask Opus 5.5 to write extreme music theory wankery and it will do it
> in javascript. Theory-porn as a genre? everything you see and hear is
> generated from javascript code that claude wrote. no samples, no libraries"

Visual style to match: Black background, bright flashing colors, chords/tone shifts clearly labelled in one corner legibly, circular note-chart in center with chords flying towards the viewer with beautiful abstract particles emanating as they do.

## Hard constraints
- No audio samples and no external libraries. All sound is synthesized with
  the Web Audio API; all visuals use Canvas/WebGL/SVG directly.
- The music must be microtonal: use tunings outside 12-TET (e.g. 19-, 31- or
  53-EDO, just intonation, Bohlen-Pierce). Show the active tuning and theory
  on screen, in the spirit of the "theory-porn" look.
- Plain HTML/CSS/JS that runs by opening the page. No build step.

## Flashing lights warning (required)
- Show a photosensitivity warning screen before anything plays or flashes.
- Nothing starts until the user clicks "Start". This also satisfies browser
  autoplay rules for audio.
- Offer a reduced-flashing mode, and respect `prefers-reduced-motion`.

## Quality checks
- No console errors on load or during playback.
- Put a limiter/compressor on the master output so nothing clips painfully.
- Include a stop/mute control that works instantly.
