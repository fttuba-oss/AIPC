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
