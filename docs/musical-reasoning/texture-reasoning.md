# Texture: melody, countermelody and accompaniment

Status: initial working principles, informed by score analysis of Sunny Island and broad teacher agreement. No general-purpose detector or numerical weighting has been validated yet.

## Roles

- **Melody:** the principal thematic line in its phrase context. It can be low, slow, quiet, harmonised or shared between instruments.
- **Countermelody:** a coherent independent secondary phrase heard against a principal melody. Independence concerns rhythm, contour and phrasing, not merely different pitches.
- **Accompaniment:** harmonic, bass or rhythmic support, including ostinatos and repeated chord figures. A moving bass is not automatically a countermelody.
- **Decoration / response:** fills, runs, answers and obbligato fragments. Do not force them into a continuous countermelody label.
- **Transition / shared foreground:** passages with exchanges or gestures rather than one stable principal tune.

Allow multiple roles within a part, phrase and measure; polyphonic parts may contain simultaneous roles. Store role assignments over spans rather than labelling an instrument for the whole piece. Silence is not accompaniment.

## Current principles and reasons

1. **Follow thematic identity across time.** An exposed statement supplies a useful reference for later statements with added lines. The teacher observed that a melody often appears alone first and gains countermelodies later. This is a useful prior, not a requirement: introductions, variations, fugues and deliberately concealed themes can depart from it.
2. **Compare in sounding pitch.** Respect instrument transpositions and octave conventions before comparing lines. Otherwise genuine doubling can appear to be a conflicting theme.
3. **Group melodic doublings.** Unisons, octave doublings and closely parallel harmonisation can form one melodic layer. Different instrument names or chord tones do not imply independent countermelodies.
4. **Use phrase context to distinguish harmony from counterpoint.** Compare onset patterns, contour, cadence, rests and independence over a phrase. Shared rhythm is evidence of harmonisation, not proof; independent voices may temporarily move together.
5. **Do not equate prominence with role.** Highest pitch, loudest dynamics, most notes, first staff or trumpet instrumentation cannot establish melody alone. Sunny Island B/C places a moving lower-band line beneath bright upper chord figures; H/I retains broad brass foreground against active upper winds.
6. **Separate decorative activity from a secondary theme.** Short fills may answer a melody without becoming a sustained countermelody. Sunny Island E is a reference example.
7. **Let roles change at handoffs.** Rehearsal letters are starting boundaries, not sufficient segmentation. Check pickups, phrase entries, cadences, orchestration changes and overlapping endings.
8. **Keep uncertainty explicit.** Where an inner line could be melodic accompaniment or countermelody, retain both interpretations and the evidence needed to decide. Sunny Island G is an initial example.

## Proposed detection workflow — not implemented

1. Parse concert-pitch events with onset, duration, ties, voice/staff, rests, articulations, dynamics and score locations. Resolve repeat structure and keep written bar labels distinct from playback occurrences.
2. Propose nested section and phrase boundaries from rehearsal marks, cadences, rests, texture changes and thematic recurrence. Include pickups and overlaps.
3. Extract candidate voices; avoid flattening a chordal or multi-voice part into a single sequence. Group exact/octave doublings first, then assess harmonised layers.
4. Find recurring phrase families using rhythm, interval contour and cadence. Allow transposition, octave displacement, ornamentation, fragmentation and augmentation/diminution. Preserve multiple candidates when identity is ambiguous.
5. Use earlier exposed statements as evidence when available. Trace subsequent thematic entries, transfers and overlaps; revise the initial reference if later context contradicts it.
6. Assess candidate roles from thematic continuity, phrase coherence, independence, harmonic function, rhythmic repetition and orchestration. Treat register, activity and dynamics as supporting evidence. Do not invent fixed weights without validation.
7. Return spans with role, thematic family, instruments/voices, doubling relationships, confidence, supporting observations and alternatives. Allow no countermelody, shared foreground and uncertain classifications.
8. Compare with teacher annotations. Evaluate phrase boundaries, role assignments, thematic tracking and doubling groups separately; check earlier cases after every rule revision.

## Challenges for future cases

Imitation and fugue; overlapping themes; melody embedded in chords; hocket; changing metres; pedal points that become foreground; heterophony; percussion-led themes; solo-and-response textures; improvised or audio-only material. These require new evidence, not automatic extensions of the Sunny Island interpretation.

## Suggested annotation fields

`piece`, `score_revision`, `written_bar_start/end`, `beat_start/end`, `playback_occurrence`, `part/voice`, `role`, `theme_id`, `doubling_group`, `confidence`, `observations`, `interpretation`, `alternatives`, `teacher_feedback`, `reasoning_revision`.

Confidence is currently qualitative (high / medium / low), not a calibrated probability. Version an implemented algorithm separately from this reasoning document.
