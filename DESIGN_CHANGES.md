# Interface update

## What changed

- Recordings now fits its floating window instead of forcing browser-sized dimensions. Its columns reorganise according to the window width, with a vertically scrollable layout below 600px.
- Sent exercises uses a grid based on available panel space, with a shorter heading and readable filters.
- Score exercises has larger titles and supporting text, quieter classification badges, and expandable practice notes.
- Exercise editors and recipient selection use larger controls and visible keyboard focus. Passage selection is available through a keyboard-accessible title button.
- Practice plans has a responsive composer and a larger message field.
- Student inbox and practice workspace have lighter typography. The practice workspace uses the neutral app background.
- The suggestion toolbar starts collapsed, with a neutral surface.
- Initial window sizes give the content more room. The saved layout key is updated so the revised defaults apply once.

## Running the app

Install Node.js compatible with Vite 8, then run these commands inside the AIPC folder:

```sh
npm ci
npm run dev:teacher
```

Open the local address shown in the terminal. The student portal is at `/student.html` on the same server. The existing development API and shared storage remain in place.

Dependency folders, generated build files, TypeScript build caches and Git metadata are omitted from this source archive. Source files, scores, stored data and the separate Score Following project are retained. Reinstall dependencies before running the project.

## Validation

- TypeScript project build passed.
- Production Vite build passed. It still reports the existing large music-rendering bundles and the Verovio browser externalisation warning.
- Browser checks passed for exercise editing/cancellation, recipient selection, search/empty state, and the plan composer. No assignments or plans were sent during these checks.
- Recordings frame and layout had no horizontal overflow at 320, 520, 800 and 1120px panel widths.
- Student inbox and practice workspace were opened and checked.

The changes cover the active interface. Older unconnected components are retained. Audio diagnostics, recording accuracy and deployment were outside this interface update.

## Smooth student tracker

The student score now draws one blue cursor on the staff. A requestAnimationFrame loop reads the audio transport clock directly and interpolates between cached rendered note coordinates. The cursor sustains to the line end before moving to the next system. Geometry is rebuilt after notation, zoom, part visibility and container-size changes. OSMD's additional cursor is hidden.

Validation includes interpolation tests for uneven note spacing, line boundaries, backward seeks, loops and score limits. Browser playback samples confirm continuous movement, a stable staff height, and a stationary cursor after pause.

## Metronome correction

- Live subdivision changes rebuild future clicks without moving the score position. Tempo changes use the same scheduling path and retain subdivisions.
- Subdivisions are scheduled while muted, so unmuting restores the selected pattern.
- Tempo edits retain the current score position after seeks and earlier tempo edits. The displayed BPM reads the engine's current score tempo and playback speed.
- Count-in clicks and music share the audio transport. A tempo edit during the count-in preserves the remaining fractional beat and beat numbering. Pending starts are cancelled if playback is stopped during sound loading.
- Score metre maps govern accents, bar boundaries and count-in length. Compound metres such as 6/8 count dotted beats. Their controls use relative subdivision labels.
- The timeline uses the score tempo map and duration. Hardcoded preview time values have been removed.

Validation: ten focused tests passed for metronome patterns and tracker geometry. Browser scheduling checks passed for live settings, mute/unmute, repeated tempo edits, seeking, tempo-map changes and count-in timing. Live UI checks passed with no page errors. A MusicXML fixture changing from 3/4 to 6/8 verified the three-beat count-in, dotted-beat display and updated subdivision controls. TypeScript and production builds passed.

## Integrated notation controls

The student transport now has a reusable metronome control with notation-only subdivision buttons, descriptive tooltips and accessible labels. The settings panel contains the tempo slider, beat indicators and a one-bar count-in option. The toolbar wraps when space is limited.

In simple crotchet metre, the choices show a crotchet, two quavers, three quaver triplets and four semiquavers. Compound dotted-crotchet beats show a dotted crotchet, two dotted quavers, three ordinary quavers and four dotted semiquavers. Minim and quaver pulses also use their corresponding note values. Quarter-note BPM retains fractional precision so dotted-pulse tempo steps remain accurate.

Validation: 13 focused tests passed, along with TypeScript and the production build. Browser checks verified the notation controls, selected state, tempo slider, optional count-in, audio-engine integration and fractional tempo precision, with no page errors.
