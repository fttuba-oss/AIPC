# Musical reasoning decisions

## 2026-11-02 — Establish a revisable texture knowledge base

**Evidence:** Sunny Island full-score analysis; teacher described the analysis as “quite accurate” and the reasoning as “quite good”. The teacher also observed that an initial exposed melody often gains countermelodies in later statements.

**Decision:** Preserve thematic continuity, phrase-level roles, doubling groups and independence as core working principles. Keep decorations and transitions available rather than forcing every active line into melody/countermelody/accompaniment. Treat exposed-first thematic presentation as a prior with exceptions.

**Limits:** Broad teacher agreement does not validate every section or an automated algorithm. Sunny Island G's inner line remains provisional. No numerical classifier has been implemented or benchmarked through this work.

**References:** [Principles](texture-reasoning.md), [Sunny Island case](cases/sunny-island.md).

## Future entry format

Date; question; previous rule; score evidence and teacher feedback; accepted/rejected/provisional change; rationale; scope and exceptions; effect on earlier cases; links to annotations and implementation if any. Append corrections rather than silently removing the history.

## 2026-11-02 — Expose structural ranges and retain pickup handoffs

**Teacher request:** show how long each role lasts and organise line previews into sections.

**Decision:** merge contiguous equivalent roles in a selected part's role map, separate full-bar rests using note durations (including sustains across barlines), and preview complete annotated sections. Treat melodic pickups at 6/20/32/40 and the closing/upper-wind links at 53–54/64/74 explicitly in the runtime Sunny Island annotation.

**Evidence and limits:** the earlier worked example already identified these pickups and links. Handoff bars can contain both the outgoing and incoming melodic groups; assigning both to the foreground preserves their entries without claiming that their entire bar has identical function. These remain bar-level interpretations. Section cards must not imply beat-accurate classifications or identify silence as accompaniment.

**Validation:** tests cover merged roles, rests, pickup inclusion and complete coverage without duplicate part assignments. Browser checks verify full-section preview bounds and seeking without re-engraving or losing the tracker after part changes.

## 2026-11-02 — Separate combined player parts before assigning practice roles

**Teacher request:** split combined staves such as Flutes 1–2 into individually usable parts.

**Evidence:** Sunny Island P2/P16/P17 alternate between shared single lines, chordal doubling and independent voices. P2 bar 61 changes encoding within the bar. P2 bar 8 contains three simultaneous pitches, so a universal top/bottom reduction would lose a source note. Flute 2 sustains repeated D5 half notes against flute 1's melody at 41–43, returning to the shared melodic layer at 44.

**Decision:** extract named player pairs into a runtime XML copy; preserve explicit voices, distribute shared two-note chords, share unisons and keep extra notes with a review flag. Apply the flute 2 accompaniment exception at 41–43 rather than assuming every extracted voice has its source staff's role.

**Limits:** chordal score condensation cannot always determine individual players uniquely. Independent part IDs do not imply independently verified role analysis for every phrase. Do not apply this two-player extraction to piano/grand staves or unlabelled chords.

**Validation:** browser comparison preserved every original pitched onset/duration and every dynamic curve. Parsed playback verified separate upper/lower flute pitches and concert-pitch horn notes. Individual selection, role exclusion, separate mixing and tracker visibility were checked.
