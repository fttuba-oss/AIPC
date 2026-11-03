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

## Mobile score-first layout

Below 1024 CSS pixels, or on touch screens up to 1400 CSS pixels, desktop navigation and the persistent mixer are replaced by a compact title/part/section header and bottom transport. This includes landscape iPads that previously retained both desktop sidebars. The score uses the available width and smaller paper margins. Landscape phones and iPads retain 1.05 engraving zoom. Its repeated title/one-part labels are omitted; explicitly displayed additional staves retain part labels. Portrait phones up to 560 CSS pixels use the selected **C · More bars** layout: 0.72 engraving zoom, narrower paper margins and closer system spacing with collision handling retained. The one-row toolbar keeps Play/Pause, BPM, Practise with and More visible; restart, tempo adjustment and metronome controls remain available in More. Bars per line adapt to musical density rather than being fixed to four. Safe-area insets and dynamic viewport height accommodate phone notches and browser controls. The student page permits native browser pinch zoom.

**Practise with** opens the existing controls in a bottom sheet; **Done**, Escape or the backdrop closes it. **Role map** opens that sheet with the map expanded. **More** contains subdivisions/count-in, playback seeking, recording and navigation. Opening settings does not resize/re-engrave the score or discard selections. The sheet traps keyboard focus, makes background controls inert, and restores focus when closed.

Keyboard Space activates focused buttons normally. The development tap shortcut ignores interactive controls, and the strategy coach's shortcuts are inactive while its modal is closed.

Controlled width reflow replaces OSMD's competing automatic resize handler. The tracker keeps its musical beat when rotating or changing parts and is repositioned using newly measured geometry. Landscape checks use 844×390 and 667×375 phone viewports; portrait checks use 390×844, followed by desktop restoration. These are browser-emulation checks, not certification on every physical phone or browser.

### iPad presentation and startup

Landscape touch tablets use a temporary side drawer, up to 380 CSS pixels wide, instead of a permanent mixer. Portrait uses the bottom sheet. Opening controls never reduces the score's layout width. Tablet checks cover 1194×834, 834×1194 and 1366×1024, including part/section retention after rotation.

OSMD 2.1.2 has a cross-system wavy/trill-line calculation that indexes visible staves using a full-score staff number. After hiding instruments, some line breaks cause `undefined.Measures` and leave an empty SVG. `scoreRendererFixes.ts` installs an isolated calculator adapter that resolves the staff by identity for that calculation, then restores the original systems. Trill continuation marks remain enabled. Review this adapter when upgrading OSMD. Regression checks must verify actual visible SVG notation and renderer warnings, not just a visible cursor or successful app startup.

Session storage falls back to memory when localStorage access is denied, so a restricted browser context can still practise. Those sessions are not guaranteed to persist after reload. The student HTML has a module-load failure message; the React startup boundary reports render failures with reload/error details. Score loading/redraw failures also have visible status messages. These measures address reproducible failure paths; an unverified device-specific blank screen still needs the iPadOS/browser version and failing URL. Safari/WebKit could not be installed in this execution environment, so the tablet checks use Chromium touch emulation.

The C portrait layout is restored automatically after rotating back from landscape, without changing the selected part or musical position.

## Keep the screen awake during playback

The student viewer requests the browser's Screen Wake Lock during count-in, score playback and musical-line previews. It releases the lock when playback/preview stops, when the page is hidden, or on unmount. Returning to the visible page requests it again if practice is still active. Idle score viewing does not hold a lock.

This uses the native API on HTTPS (or localhost). Browser/device support and operating-system battery policy determine whether a request succeeds or a lock is released. Rejection or an unavailable API never interrupts the music. There is no fake-video fallback or change to the device's permanent auto-lock setting. Tests cover background/foreground transitions, pending request cleanup and denial; browser checks verify that the actual playback and preview controls acquire/release their locks.
