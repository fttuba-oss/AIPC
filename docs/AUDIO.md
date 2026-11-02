# Integrated practice playback

## Setup

Use Node.js 24 LTS (Vite 8 requires a recent Node runtime). From the repository root:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

On Windows PowerShell use `npm.cmd` in place of `npm` if script execution is disabled.
The normal `predev` and `prebuild` hooks run `npm run setup:audio`. The first run downloads
and extracts FluidR3 and 31 VSCO recordings; later runs verify and reuse the cached assets.
Windows 10/11's built-in `curl.exe` and `tar.exe`, or equivalent commands on other platforms,
are required for the asset setup. No FluidSynth desktop installation, Python, API key, or
separate audio server is needed. Browser playback requires a current browser on localhost or HTTPS.

The first asset setup downloads a roughly 120 MB Debian package plus the selected WAVs.
The generated bank and recordings live under `public/audio/vendor/`; they are deliberately
excluded from Git. Keep these generated files when deploying the output of `npm run build`.
The wasm/JavaScript runtime comes from the pinned `js-synthesizer` npm package. Assets are
served by the app after setup, so playback does not depend on a live sample CDN connection.

`npm run setup:audio` can also be run explicitly. It verifies the Debian package, extracted
SoundFont, and each VSCO sample against the checked-in hashes in `audio-assets.json`.
`AIPC_AUDIO_ASSET_DIR` and `AIPC_AUDIO_CACHE_DIR` optionally override output/cache directories
for clean setup checks; ordinary development should leave them unset.

## Sounds and timing

- Winds, brass, timpani, pitched percussion, and other General MIDI melodic instruments use
  **FluidR3 GM through a FluidSynth WebAssembly audio worklet**. Each part has an independent
  channel. Program names distinguish piccolo, the saxophone families, string bass, and tubular bells.
- Flute modulation-wheel input is zero and the additional amplitude LFO is reduced from
  8 to 4 centibels. This is the approved softer-modulation audition setting; vibrato recorded
  inside the SoundFont samples is not removed.
- Named orchestral snare, bass drum, crash cymbals, suspended cymbal, and tam-tam use **VSCO 2 CE**
  WAV recordings, with recorded velocity layers and alternating hits. Concert part names resolve
  GM aliases: Sunny Island's Chinese Cymbal becomes tam-tam, and its two crash-cymbal programs
  are separated into crash and suspended-cymbal voices.
- Side-stick and unrecognized GM percussion keys use FluidR3's drum bank rather than an invented
  noise voice. Timpani and other pitched percussion retain their sounding pitches.
- One-shot percussion rings for the recording's natural duration. Explicit Stop, seeking,
  starting another take, and closing the viewer stop old voices. Natural completion of a section
  allows its percussion tails to finish.
- Snare and suspended-cymbal rolls use recorded roll/crescendo samples. Other marked rolls use
  alternating recorded strikes. Percussion grace notes are grouped into short pre-beat ornaments;
  the main written onset is unchanged. This is an initial articulation model, not a complete
  interpretation of every extended percussion technique. Loop transitions and balance still
  deserve listening checks in different scores.
- Melodic ties merge only actual tie chains, including ties interleaved with chord notes.
  Slurs retain separate note attacks. Connected different pitches overlap by up to 25 ms;
  continuation attacks are softened, and repeated pitches retain a small gap to avoid the
  same-pitch sampler release problem. These are sampler-based connections, not recorded true legato.

Audio worklet events are timestamped against the same AudioContext as Tone's transport.
The worklet renders block segments at note boundaries; tracker timing is not driven by network
requests, React renders, or browser animation cadence. Loading/error states are shown before playback.

## Mix and notation

"Play with whole band" enables the accompaniment parts and automatic balance; clicking it again
turns the accompaniment off while retaining the student's own part. "Mute my part while I play"
continues to apply. Individual levels, sound selection, and staff visibility remain independent.
The algorithm attenuates doubled lines and dense textures without rewriting score dynamics.
FluidSynth uses independent channel expression; WAV voices use independent audio gains. A master
limiter and output headroom protect the combined output. Automatic melody-role detection is not
implemented.

MusicXML transposition instructions, including explicit zero, octave shifts, numbered staves,
and later changes, determine sounding pitch. Missing XML transposition means concert pitch;
labels alone do not override it. OSMD's pitch numbering is converted to MIDI numbering once.

The viewer chooses its own line breaks and does not stretch the last line. Tracker coordinates
are rebuilt from rendered geometry. At note onset the target is 4 CSS pixels before the notehead's
left edge. Whole-rest starts use the left barline, or the right edge of an opening time signature.
Count-in and playback honor the selected bar. Exercises start with the crotchet subdivision.

## Verification

```sh
npm test
npm run build
npm run lint
```

The existing lint command reports pre-existing warnings. Regression coverage includes concert
transposition, ties versus slurs, interleaved chord ties, tied percussion rolls, percussion mapping,
velocity-layer selection, duplicate/density balance, and worklet onset/release and stop behavior.
Browser integration checks additionally exercised Sunny Island with all parts, real FluidR3 and
VSCO loading, seek/mute/stop, natural gong decay, the whole-band toggle, and the crotchet default.
Cloud browser checks do not establish that a Windows machine has received these source changes.

## Sources and credits

- [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), revision
  `440300901dfe9275fd84e0b7763af1f8443ae62e`, **CC0 1.0**. Recordings by Sam Gossner / Versilian
  Studios and Simon Dalzell / Ivy Audio; sample cutting by Elan Hickler / Soundemote.
  The selected gong recording is used as the current tam-tam candidate.
- [FluidR3](https://packages.debian.org/trixie/fluid-soundfont-gm), Debian package `3.1-5.3`,
  SoundFont by Frank Wen and contributors, **MIT**. The Debian packaging has its own notice.
- [js-synthesizer](https://github.com/jet2jet/js-synthesizer), `1.13.0`, **BSD-3-Clause**.
- [FluidSynth](https://github.com/FluidSynth/fluidsynth), WebAssembly build supplied by
  [fluidsynth-emscripten](https://github.com/jet2jet/fluidsynth-emscripten), **LGPL-2.1**.
  The upstream runtime is distributed unmodified and can be replaced independently.

License texts and upstream notices are retained under `licenses/` and copied alongside the
runtime assets. No commercial Sibelius/NotePerformer libraries are bundled.
