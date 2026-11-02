# Musical reasoning library

This folder preserves reusable musical principles, score evidence, teacher feedback and revisions across pieces and development sessions. It is a human-readable knowledge base, not an implemented texture detector or an automatically loaded AI memory.

## Start here

- [Texture reasoning](texture-reasoning.md): current principles and a proposed detection workflow.
- [Sunny Island](cases/sunny-island.md): the first worked example, including uncertain classifications.
- [Case template](cases/TEMPLATE.md): capture the next piece consistently.
- [Decision log](decision-log.md): what we learned, changed or rejected, and why.

For future analysis, ask: **“Read docs/musical-reasoning/README.md and the relevant cases first. Apply the current reasoning, identify where this score challenges it, and record supported revisions.”** When working in another project, copy this folder or provide access to it and use the same instruction. A folder alone does not ensure that another assistant or application reads it.

## How the library grows

1. Analyse a new score using the current principles, checking concert pitch and musical context.
2. Record bar-specific evidence, competing interpretations and confidence in a new case file.
3. Record the teacher's feedback precisely. Broad agreement is not verification of every bar.
4. If the case challenges a rule, first consider whether the rule needs narrower conditions. Keep useful alternatives rather than forcing a universal rule.
5. Update the principles and decision log, linking the supporting cases. Preserve the previous reasoning and explain departures.
6. Before implementing a change, check it against earlier cases. Report improvements, regressions and unresolved passages separately.

Use these evidence labels: **observation** (what the score contains), **interpretation** (the musical role inferred), **hypothesis** (an untested generalisation), and **teacher feedback** (what the user actually confirmed).

Do not store private internal thought transcripts. Preserve concise rationales, observable evidence, assumptions, alternatives and decisions that another musician or developer can inspect.
