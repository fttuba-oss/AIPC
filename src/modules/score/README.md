# Shared score playback and orchestra mixing

Both teacher and student views use `ScoreViewer.tsx`. No practice-domain or shared-contract changes are required for these playback features.

## Student/teacher controls

- **Visible staves** initially shows the assigned instrument when its name resolves uniquely, and changes notation only; the complete orchestra remains audible.
- **Balanced orchestra** retains every notated playback event, with stable initial instrument-family gain presets, compensation for repeated patches, restrained stereo placement/reverb, reserved master headroom and compressor-based limiting.
- **My part** selects the guide instrument independently of the visible score. An unambiguous assignment instrument name is selected automatically; ambiguous names require a choice.
- **Mute my part** silences that part, including already-sounding notes. Another instrument doubling the same melody remains audible.
- **Clear lines** is a conservative educational reduction: identical patch, sounding pitch, beat, duration, articulation and expression can share one rendered event across parts. Different instruments, octaves, expressive differences, independent same-part voices and percussion remain distinct. The guide is kept separate from reduction groups for independent gain control. Unsupported continuous-expression regions are protected from reduction.
- Orchestra, guide and metronome faders change live audio gain. **Metronome only** mutes all score audio. The output meter observes both channels; it is a sample-peak indicator, not a true-peak/loudness measurement.

## Code responsibilities

- `engine/scoreTracker.ts`: explicit left/right bar boundaries with interior engraving anchors, so beat one starts at the left barline even for centred whole-bar rests, empty bars or a new system. When multiple staves are visible, the tracker follows the visible My part selection rather than borrowing attacks from other instruments; changing My part updates these anchors immediately. Pitched attacks align with the left edge of noteheads; hidden staves and rest glyphs cannot override their positions. Seeks use the requested musical time without a delayed engraving-cursor reset.
- `engine/musicXmlPlayback.ts`: canonical source events and identity, GM instrument metadata, concert-pitch conversion including explicit zero/octave transposition, part/staff/voice-scoped dynamics, authored channel volume/pan, tie chains, articulation and cue-note handling. Ties sustain; slurs retain attacks.
- `engine/orchestraMix.ts`: pure event planning and initial balance settings. Proven duplicate source events are removed by provenance. Clear-line grouping happens after mutes and retains all contributing part IDs; source data stays immutable.
- `engine/orchestraAudio.ts`: separate sounding voices and persistent gain/pan buses per part; decoded sample buffers shared across voices; family buses and light reverb send. Primary acoustic samples and General MIDI soundfonts are attempted, with bounded loading time and an identified synthesis fallback. Unpitched percussion uses synthesized drum/noise voices and is never pitch-deduplicated.
- `engine/studentAudioEngine.ts`: the existing tempo-aware transport, seek/count-in/metronome scheduling, mix changes, sustained-note resumption after seeks, output headroom and cleanup. The older voice path remains for archived consumers without an orchestra part list.

When all authored pans are centered (or unspecified), subtle family stage positions are used. Otherwise authored positions are respected. Family balance and static patch-count compensation are starting presets, not measured/perceptually calibrated orchestral balance. They do not dynamically normalize every chord or erase velocity differences. The limiter is Tone.js's compressor-based limiter, not a guaranteed true-peak brickwall ceiling.

## Verification

```sh
npm run test:score
npm run build:score
npx tsx --test tests/score/orchestra.browser.ts tests/score/tracker.browser.ts
```

The orchestra browser suite starts its own isolated score workbench on port 5192. It uses installed Chromium (override with `AIPC_CHROMIUM_PATH`), exercises source pitch/expression interpretation, and performs actual offline audio renders with deterministic reference samples. It checks different timbres, unison reduction, independent guide/orchestra faders, guide muting, sustained-note muting, a 31-part headroom reference, silent faders and fallback synthesis. It also tests the real sampler loading pipeline using routed WAV/soundfont fixtures, so it does not depend on third-party CDNs.

The full bundled *Sailing with Whales* source currently produces 18,848 playback events across 31 parts and 24 patches (including unpitched notes and merged ties). Balanced mode retains all events; Clear lines renders 17,287 with no guide selected or manual mutes. These are playback counts, not the raw pitched-note overlap figures in the earlier research audit.

Also run `npm test`, `npm run build`, and `npm run test:browser` to verify the application boundaries and teacher/student assignment workflow. Run the independent workbench with `npm run dev:score` and use `/dev-score.html` on port 5180.

## Remaining listening and interpretation limits

This does not turn General MIDI samples into a human orchestra. Actual patch loudness, phrasing, articulations and speaker/headphone balance require listening and library-specific calibration. Remote acoustic/soundfont availability is environment-dependent; the UI reports fallback synthesis.

Written dynamic marks and explicit MIDI velocity are applied at note onset with correct scope. Continuous hairpins/pedals/bends are not fully rendered as sustained expression curves; protected regions are retained in Clear lines. Repeat/ending expansion, ornament/grace-note realization, arbitrary custom banks and full General MIDI program coverage remain outside this change. Source pitch and event timing are aligned to the existing score/tempo timeline; this is playback-following, not live microphone alignment.
