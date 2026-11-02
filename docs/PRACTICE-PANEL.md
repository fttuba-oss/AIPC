# Student practice accompaniment

The persistent panel beside the score provides three modes:

- **My part only:** the student's reference and optional metronome.
- **With a musical line:** select any combination of melody, countermelody/supporting lines and accompaniment. Instrument groups follow the saved annotations as playback or seeking changes section.
- **Choose instruments:** keep fixed instrument selections throughout the piece, with whole-band toggle, clear selection, individual volume and optional staff visibility.

**Hear my part** controls the student's reference independently of backing selection. **Reference audio** mutes all reference sound; the metronome remains independent. Automatic balance continues to reduce doubling/density within the audible selection.

The student's current musical role is disabled in musical-line mode, with the explanation “You play this line.” Previously selected lines are suspended while the student carries them and resume when roles change. This applies to playback and previews as well as the controls and listening summary. To hear other instruments doubling the student's line, use instrument mode.

Line previews play the selected analysis section from its first bar to its end, excluding the student's own part. The section picker and each card show the exact written bar range. Previews use the selected tempo preset and written dynamics, have no count-in or metronome, and are available while idle. Starting practice, a demo or recording stops the preview. Previewing does not change the backing selection or score cursor.

The role card shows the current continuous role span and the next span. **View my role map** lists the whole part in order; selecting a row seeks to its first bar. Adjacent phrases with the same role/label merge, while full-bar rests form separate spans. Rest detection includes held/tied notes crossing a bar. These are structural, bar-level summaries, not exact within-bar role boundaries.

## Annotation scope

`src/utils/practiceTexture.ts` contains initial curated, part-level spans for the analysed Sunny Island score. A source-content fingerprint binds these to the exact XML revision. An edited/re-exported score requires checking and rebinding its annotations. A title match alone is insufficient.

These are section/phrase summaries translated from [the reference case](musical-reasoning/cases/sunny-island.md), not a validated automatic detector. Known pickup/handoff bars at 6, 20, 32 and 40 and the links at 53–54, 64 and 74 have separate or overlapping-layer assignments. A part may still change function within a bar or contain multiple simultaneous voices; these are not isolated at note level. Supporting-line labels preserve uncertainty, particularly at G. Rosters identify assigned parts, including parts that rest for some of the span.

Other scores retain own-part and instrument practice. The musical-line mode is disabled with an explanation until a score-specific analysis is available. Do not infer roles from staff order or instrument family to fill this gap.

## Timing and score presentation

The audio engine evaluates the current part selection on its transport schedule and refreshes held-note gains at measure boundaries. This avoids relying on UI progress updates for handoffs. The panel updates its section and roster from the playback position or selected starting bar.

Selecting audio does not automatically add staves or re-engrave the score. Students can explicitly show another staff with the eye control in instrument mode. Seeking no longer resets OSMD's hidden cursor or triggers layout. After a part/layout change, the viewer rebuilds geometry and brings the same musical position into view. Browser scroll anchoring is disabled within the score viewport. Notehead offset and rest-start anchor rules are retained.

## Notation placement

`scoreDisplay.ts` creates a display-only MusicXML copy. Explicit articulation/slur placement is preserved. Where absent, standard short articulations and slurs use a consistent above placement for a single voice, and above/below placement for upper/lower independent voices on the same staff. Explicit slur orientation is respected; ties and specialist breath/technique marks keep their normal engraving rules. OSMD's slur obstacle handling is enabled. Original MusicXML, playback articulations and analysis fingerprint are unchanged. This is a display convention, not a guarantee that every dense or cross-staff engraving needs no manual review.

## Separate players from combined parts

`splitScoreParts.ts` makes an in-memory practice-score copy for explicitly named pairs of single-staff wind/brass players. Sunny Island's combined flutes and two horn pairs become **Flute 1**, **Flute 2**, and **Horns 1–4**: 34 individually selectable parts in total. The uploaded score remains unchanged.

Independent voices retain their own rhythm. In shared-voice passages, upper/lower chord tones go to the first/second player; a single shared line goes to both. A later independent voice can enter after a shared chord passage within the same measure. Missing space is filled with rests. Shared articulations/slurs are retained on extracted chord tones. Dynamics, timed directions and transpositions are copied with their musical locations intact; generated instrument IDs are independent.

Extraction does not silently delete surplus chord tones. Flute bar 8 contains a two-note chord in the upper explicit voice plus a simultaneous lower voice: three pitches for two named players. Those notes remain in the upper/lower extracted voices, and the flute controls show a source-review notice. Resolving that source ambiguity requires a musical decision, not dropping a pitch automatically.

Supported names explicitly identify two numbered flute/horn/clarinet/trumpet/trombone/oboe/bassoon players. Grand staves, more than two voices, ordinary chordal instruments and solo/player-only instructions are not automatically split. Shared single-line material assumes both players participate; this is not a general conductor-score part-extraction engine.

Role annotations expand to the independent IDs. Verified Sunny Island flute 2 support at 41–43 is labelled accompaniment, with its return to the melodic layer at 44. Other extracted players inherit the analysed source layer pending any further voice-specific review. The tracker uses the newly engraved individual staff and retains the selected musical position during part changes.

## Checks

`npm test` includes score binding, thematic handoffs, fixed-instrument behaviour, independent own-reference selection and annotation coverage. Run `npm run build` for type checking and the production build. Browser checks should cover radio/checkbox controls, whole-band on/off, previews, seeking across E/F/H, and unsupported-score messaging.
