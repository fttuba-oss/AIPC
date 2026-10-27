# Orchestral MIDI playback: clarity without losing the orchestration

## Recommendation

Use **Balanced orchestra** as the default: preserve every notated part, fix instrument routing and dynamics, and mix the parts through calibrated instrument/section buses. Offer **Clear lines** as an optional educational reduction. Do not implement “keep only unique pitches at each instant” as the normal orchestra mode.

The student should also have a **Mute my part** toggle. This removes only their assigned part, not other instruments that happen to double the student's melody. A guide-part fader can keep a quiet reference if desired. Display/notation selection should be separate from the audible mix; selecting a staff must not unintentionally turn the orchestra into a solo.

This is an engineering and musical recommendation, not a claim of a controlled listening-study result. The evidence reviewed consists of the MusicXML standard, the Web Audio specification, Tone.js 15.1.22 implementation, the application/prototype code, and a descriptive audit of bundled scores. Direct requests to orchestration websites and search were blocked by the environment's egress policy; the primary standards were retrieved through their official GitHub repositories. No perceptual comparison or listening test has been performed yet.

## What “duplicate” means

| Case | Balanced orchestra | Clear lines |
| --- | --- | --- |
| Accidental duplicate import/scheduling of the same source event | Remove the accidental copy using source provenance | Same |
| Separate parts triggering the same patch/sample, pitch, onset, duration, articulation and expression | Preserve musical part identities; control shared-unison loudness | May coalesce rendering, retaining every contributing part ID |
| Flute and violin play the same sounding notes | Preserve both timbres and balance them | May offer a teacher-approved reduction of sustained phrase-level doubling |
| Same melody in different octaves | Preserve: orchestral register and bass are meaningful | Preserve by default; octave reduction needs explicit approval |
| Parts meet on one chord then diverge | Preserve both | Do not repeatedly delete/change instruments at isolated coincident notes |
| Same pitch/onset with different lengths, articulation, dynamics or tie state | Distinct events | Distinct events unless an intentional arrangement is approved |
| Percussion/unpitched notes | Separate instrument/drum identities | Exclude from pitched-line deduplication |

Matching pitch and onset is insufficient to establish that two musical lines are duplicates. Comparing whole parts is also too coarse: independent parts may double only for a phrase. Use phrase-level similarity for suggestions, not automatic deletion. Keep a stable representative over a phrase/section to avoid timbre jumping between notes.

## Why the current playback can lose clarity

The active viewer flattens all part notes into one note list. `NoteEvent` declares `partId` and `instrument`, and the engine uses these fields for instrument loading and part mixing, but the parser currently does not populate them in the emitted notes. Its final cleanup only removes `rawNote`; it does not restore these identifiers. Consequently the default path can use the shared synthesized fallback voice instead of rendering the intended orchestral timbres. Duplicated lines in that voice can reinforce rather than sound like different players.

Other code findings:

- Dynamics discovered in the iterator are applied to all entries in `partRunningVolume`, so an expression detected for one part can affect every part. Direction/staff/voice scope needs preserving.
- `setPartMix` currently multiplies note-trigger velocity rather than routing each part through a persistent audio gain bus. It cannot properly rebalance a note already sounding, and the minimum velocity clamp prevents sufficiently quiet nonzero settings. Zero does mute.
- Samplers are shared by instrument patch and connected to the common reverb/output path; independently adjustable part gain and pan require per-part voices/buses or a different voice renderer. Simply connecting one shared sampler to multiple part buses would copy all its notes into all buses.
- A common reverb adds space but does not balance the parts. Its wet level should remain modest for practice clarity.
- Transposition handling uses `||` fallbacks. Explicit zero transposition must not be mistaken for missing data, especially in concert-pitch scores. Audit the OSMD pitch convention before implementing comparison; do not transpose twice.
- The existing `Score Following/src/utils/audioEngine.ts` prototype already has `deduplicateUnisons`. It groups by rounded millisecond onset and pitch, ignores note length/articulation in the grouping key, then prefers brass over saxophones over woodwinds. It is not the active shared viewer engine. That priority scheme is not a musical rule and can systematically remove quieter colours. Rounding also creates bucket-boundary errors; beat-based event identity or explicit onset comparisons are better.

These issues should be addressed before deciding how aggressively to reduce the orchestration. They can make a correct score sound unclear even if there are no accidental duplicate lines.

## What the bundled scores show

Command: `python scripts/research/analyze_score_overlap.py` from the repository root. Results are saved in `orchestral-midi-overlap.jsonl`.

| Score | Parts | Pitched source note events | Extra coincident events across parts | Extra coincidences sharing declared MIDI program |
| --- | ---: | ---: | ---: | ---: |
| Beautiful Danxia flute excerpt | 2 | 82 | 0 | 0 |
| Sailing with Whales full score | 31 | 18,438 | 9,019 | 4,152 |
| Neruda trumpet excerpt | 1 | 66 | 0 | 0 |

The full score has substantial overlap, so this is a real concern in the supplied repertoire. However, **9,019 is not a count of erroneous notes or safely removable events**. The audit compares sounding pitch, source-timeline onset, duration, tie flags and articulation tags, using XML transposition. It does not expand repeats, merge tie chains, model expression curves, inspect MIDI bank/program switches, fully model per-staff transposition, distinguish all ornament/grace semantics, or listen to the result. Sharing a General MIDI program does not prove that two events are accidental copies. These figures justify further testing, not deleting half the orchestra.

## Proposed rendering and mixing pipeline

1. **Canonical score events.** Preserve part/voice/staff identity, source-event identity, rational beat positions, concert pitch, duration, patch/drum identity, articulation/ties and per-part expression. Keep notation and source events immutable. Correct interpretation of transposition, repeats and dynamics comes first.
2. **Apply the user's mix selection.** Full orchestra, optional muted student part, user mutes/solos, and guide level. A score-view part filter affects notation only.
3. **Remove proven duplicate imports.** Use provenance to detect the same source event scheduled twice. Equal musical content from different parts is not sufficient proof.
4. **Optional reduction layer.** In Clear lines, conservatively group truly equivalent same-patch events; preserve a membership list for all contributing parts. Recompute after mix changes so muting the selected representative never deletes another audible part. Different timbres remain unless a phrase-level reduction was explicitly selected. Never delete/modify source notes.
5. **Instrument rendering.** Use the intended patch per part. Provide either separate sampler/voice instances per part (sharing decoded sample buffers if supported) or a soundfont renderer with real per-channel gain/pan/control. A section sample should not be multiplied once per hypothetical player just to simulate section size.
6. **Part gain and pan → section buses → orchestra bus.** Apply calibration in audio gain, independently of expressive MIDI velocity. Use conservative family/role presets with manual overrides; do not adopt a fixed “brass always wins” order. Keep bass, rhythmic attacks, melody and countermelody legible. Use moderate stereo placement; ensure a useful mono mix.
7. **Space and output protection.** Separate reverb send from the dry signal; retain dry attacks. Reserve headroom, measure peaks, and add a safety limiter. Tone.Limiter is compressor-based and should not be assumed to guarantee a strict true-peak ceiling. Include the metronome in the final output/headroom policy even if it bypasses orchestra reverb.

For gain calibration, use representative reference passages/sample ranges for each patch at the same intended dynamic, then listening-based adjustments. Do not normalize each note or independently flatten every section to one loudness; that erases the score's dynamics. Dynamic balance changes should be slow and phrase-aware to avoid audible pumping.

Signal addition explains why duplicate samples are a special case. Two perfectly identical, aligned waveforms sum to twice the amplitude: approximately +6.02 dB. Two equal-level uncorrelated signals add approximately +3.01 dB in average power. Identical sample unisons and differently recorded instruments fall at different points between these conditions. Therefore neither a universal `1/N` nor `1/sqrt(N)` gain rule is sufficient for every orchestral combination. Different pitches/timbres can also mask each other even without exact note overlap.

## Suggested student controls

- **Balanced orchestra** — all notated parts with calibrated balance; default.
- **Mute my part** — toggle; keep other instruments doubling that line.
- **Clear lines** — optional simplified accompaniment, clearly labelled as a reduction.
- Orchestra, guide-part and metronome level controls. Keep advanced per-part mixing in an expandable panel rather than the main practice flow.

For selecting a practice part, use a separate control from selecting visible staves and audible parts. The current viewer has one part selector that affects both rendering and playback; these need separating.

## Implementation sequence and acceptance criteria

All of this belongs to Developer A's score domain. Practice-plan modules need no changes unless future assignments explicitly store playback preferences.

**First:** preserve metadata, correct expression scoping and pitch interpretation, and introduce actual part gain buses. **Second:** balanced full-orchestra and minus-my-part controls, calibrated presets, headroom/metering. **Third:** optional conservative same-patch reduction and phrase-level suggestions, after listening comparisons.

Verify with existing pure event/timing tests plus new cases: same notes in different timbres; same-patch unisons; different durations and articulations; octave doubling; divisi; percussion; ties vs repeated/slurred notes; transposing vs concert scores; explicit zero transposition; tempo changes; representative muted after grouping; and parts that double briefly then diverge. A slur is not a tie and must not automatically erase repeated-note attacks.

Render matched passages of the 31-part Whales score in: current engine, balanced full orchestration, conservative same-patch reduction, and aggressive unique-pitch reduction. Compare at matched perceived loudness and preserve the original as a reference. Check peak overload, retained musical lines/colours, mono compatibility, note/voice counts, CPU and start-up latency. Ask a teacher and instrumental students whether they can follow their part and hear bass/rhythmic cues; do not infer clarity from event counts or a louder render. Sample quality and human phrasing remain limitations of MIDI orchestration even after mixing improvements.

## Primary sources reviewed

1. [W3C MusicXML schema](https://github.com/w3c/musicxml/blob/5666459df5a45f51e5c474624b655125cec174d9/schema/musicxml.xsd): `<transpose>` defines written-to-sounding conversion; `<midi-instrument>` includes volume/pan; dynamics and ensemble metadata are separate concepts. This establishes what the event model should preserve, not an automatic orchestral balance algorithm.
2. [W3C Web Audio specification source](https://github.com/WebAudio/web-audio-api/blob/main/index.bs), especially GainNode, DynamicsCompressorNode, StereoPannerNode and channel mixing: incoming audio signals are mixed/summed; gain, spatialization and dynamics processing are distinct operations.
3. [Tone.js 15.1.22 Sampler](https://github.com/Tonejs/Tone.js/blob/15.1.22/Tone/instrument/Sampler.ts): trigger velocity is passed to sample playback gain. It does not by itself provide realistic orchestral dynamic layers or automatic ensemble balance.
4. [Tone.js 15.1.22 Volume](https://github.com/Tonejs/Tone.js/blob/15.1.22/Tone/component/channel/Volume.ts): independent audio gain in decibels, suitable for persistent part/bus balance.
5. [Tone.js 15.1.22 Limiter](https://github.com/Tonejs/Tone.js/blob/15.1.22/Tone/component/dynamics/Limiter.ts): implemented with fast compressor attack/release and 20:1 ratio; a safeguard, not evidence of a guaranteed brickwall true-peak output.

The orchestration/reduction policy, suggested UI, and validation plan above are recommendations inferred from those capabilities and the code audit; they are not quoted prescriptions from the standards.
