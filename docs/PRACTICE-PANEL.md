# Student practice accompaniment

The persistent panel beside the score provides three modes:

- **My part only:** the student's reference and optional metronome.
- **With a musical line:** select any combination of melody, countermelody/supporting lines and accompaniment. Instrument groups follow the saved annotations as playback or seeking changes section.
- **Choose instruments:** keep fixed instrument selections throughout the piece, with whole-band toggle, clear selection, individual volume and optional staff visibility.

**Hear my part** controls the student's reference independently of backing selection. **Reference audio** mutes all reference sound; the metronome remains independent. Automatic balance continues to reduce doubling/density within the audible selection.

Line previews play up to two bars from the current position, excluding the student's own part. They use the chosen tempo and written dynamics, have no count-in or metronome, and are available while idle. Starting practice, a demo or recording stops the preview. Previewing does not change the backing selection or score cursor.

## Annotation scope

`src/utils/practiceTexture.ts` contains initial curated, part-level spans for the analysed Sunny Island score. A source-content fingerprint binds these to the exact XML revision. An edited/re-exported score requires checking and rebinding its annotations. A title match alone is insufficient.

These are section/phrase summaries translated from [the reference case](musical-reasoning/cases/sunny-island.md), not a validated automatic detector. A part may change function within a span or contain multiple simultaneous voices. Pickups, ornamental notes and within-part role changes are not isolated at note level in this first version. Supporting-line labels preserve uncertainty, particularly at G. Rosters identify assigned parts, including parts that rest for some of the span.

Other scores retain own-part and instrument practice. The musical-line mode is disabled with an explanation until a score-specific analysis is available. Do not infer roles from staff order or instrument family to fill this gap.

## Timing and score presentation

The audio engine evaluates the current part selection on its transport schedule and refreshes held-note gains at measure boundaries. This avoids relying on UI progress updates for handoffs. The panel updates its section and roster from the playback position or selected starting bar.

Selecting audio does not automatically add staves or re-engrave the score. Students can explicitly show another staff with the eye control in instrument mode. Tracker geometry and click-to-seek code are unchanged.

## Checks

`npm test` includes score binding, thematic handoffs, fixed-instrument behaviour, independent own-reference selection and annotation coverage. Run `npm run build` for type checking and the production build. Browser checks should cover radio/checkbox controls, whole-band on/off, previews, seeking across E/F/H, and unsupported-score messaging.
