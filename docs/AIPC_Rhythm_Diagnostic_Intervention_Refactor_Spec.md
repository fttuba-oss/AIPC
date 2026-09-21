# AIPC rhythm diagnostic intervention refactor specification

Version 1.0

Audience: Coding agents working on the AIPC teacher portal and student rhythm intervention flow

## 1. Purpose

Refactor the AIPC rhythm system so that practising strategies can function as both:

1. pedagogical interventions that may immediately improve performance; and
2. diagnostic interventions whose results provide evidence about the likely causes of the problem.

The system must no longer require a precise root-cause diagnosis before practice begins. It should detect a performance problem, form provisional hypotheses, select an informative and pedagogically useful first-line intervention, observe what changes, update the hypotheses and decide whether to continue, pivot or refer the case to the teacher.

The revised architecture is:

`observe -> detect problem signature -> form provisional hypotheses -> select diagnostic intervention -> practise -> compare response -> update hypotheses -> continue/pivot/refer -> fade support -> retest original passage`

## 2. Reason for the change

The present progressive-rushing route uses a relatively fixed sequence:

`PS-RUSH-01 -> single-pitch probe -> RC03 or RC08 -> fixed strategy -> fading ladder`

This is too restrictive for the following reasons:

- progressive rushing can have several contributing factors;
- one short probe rarely confirms a single root cause;
- several practising strategies can improve more than one capacity;
- the learner's response to a strategy provides new diagnostic evidence;
- requiring several separate probes before intervention creates unnecessary learner burden;
- teachers often begin with a broadly useful practice modification and diagnose through the learner's response;
- some clear problem signatures justify a targeted intervention without passing through a general diagnostic sequence.

The system should use provisional, multi-factor reasoning. It should report that evidence strengthens or weakens a hypothesis, not that one probe proves a cause.

## 3. Core design principles

### 3.1 Diagnosis continues during intervention

Diagnostic reasoning is not a separate phase that must finish before practising begins. Each intervention changes part of the task. The resulting improvement, persistence or return of an error updates the diagnostic profile.

### 3.2 Strategies may address several capacities

Do not implement one-to-one mappings such as:

`Progressive rushing = Gap Click`

Use:

`Problem signature -> provisional hypotheses -> strategy candidates -> selected diagnostic intervention -> observed response -> updated hypotheses`

### 3.3 Prefer low-burden, pedagogically useful first actions

A first-line diagnostic intervention should:

- have a reasonable chance of helping immediately;
- produce interpretable changes in performance;
- require no more than two or three initial attempts;
- retain the musical target wherever possible;
- avoid unnecessary diagnostic tasks;
- lead to an explicit next decision.

### 3.4 Use the smallest sufficient investigation

Do not run the entire probe library. Select the strategy or probe with the best balance of likely benefit, diagnostic information and learner burden.

### 3.5 Preserve uncertainty and multiple contributors

The diagnostic state may contain several contributing factors. Store a confidence or evidence-strength value for each hypothesis. Do not force a single root cause.

### 3.6 Require original-context transfer

Success in a simplified or supported exercise does not resolve the original problem. The learner must retest the original passage with original notes, rhythm, articulation and target tempo. Support designated for removal must be absent.

### 3.7 Limit automated persistence

When the same focused problem remains after two or three targeted attempts, AIPC should stop repeating the task and refer the evidence to the teacher.

## 4. Revised system architecture

### 4.1 Existing components to preserve

Preserve wherever compatible:

- MusicXML ingestion;
- score and tempo-map parsing;
- expected-onset generation;
- microphone and tap telemetry;
- onset alignment;
- existing problem-signature detection;
- RC01-RC10 rhythmic capacities;
- strategy registry;
- attempt history;
- current audio and click engines;
- exercise generators;
- support-level controller;
- original-passage retest;
- teacher and research views.

### 4.2 Components to add or refactor

Add or refactor:

1. `DiagnosticProfile`
2. `DiagnosticInterventionRegistry`
3. `FirstLineRouter`
4. `LearnerChoiceController`
5. `ResponseInterpreter`
6. `DecisionController` with Pass, Persist, Pivot and Refer
7. `TeacherHandoffRecord`
8. strategy-level diagnostic metadata
9. diagnostic evidence generated during intervention
10. support for Reference Listening with Shadow Fingering
11. support for Tempo Reduction with Strong Click as a compound diagnostic intervention

## 5. Two first-line routes

### 5.1 General front door

Use the general front door when:

- the problem is broad;
- several causes remain plausible;
- score and performance evidence do not identify a clear local mechanism;
- either general intervention could reasonably help;
- the learner can make a meaningful strategy choice.

The two default options are:

1. Reference Listening with Shadow Fingering at target tempo
2. Tempo Reduction by 20 BPM with Strong Click

The default reduction must be configurable. Use 20 BPM as the initial product behaviour, not as a universal pedagogical constant. Prevent invalid or unmusical tempi through minimum-tempo and percentage-change safeguards.

### 5.2 Targeted bypass

Bypass the general front door when the detected evidence already supports a more specific first-line intervention.

| Evidence pattern | Targeted first-line intervention |
|---|---|
| Stable with click but drifts when click disappears | Gap Click or Synchronisation-Continuation |
| Error follows ties, rests or silent metric positions | X-ray Rhythm or Ghost Beat |
| Same note-to-note transition repeatedly fails | Short-Cell or Transition Isolation |
| Slurred performance is known to succeed but articulation fails | Articulation Reduction |
| Equal subdivisions are consistently uneven | Explicit Subdivision |
| Short burst succeeds at target tempo but long span fails | Burst Practice |
| Cross-rhythm or layered periodicity is the assigned target | Layered Reference and common-subdivision intervention |
| Timing deviation may be intentionally expressive | Teacher-confirmed expressive target; do not auto-correct |

## 6. First-line diagnostic intervention 1

### 6.1 Name

`DI-REF-SHADOW-01 Reference Listening with Shadow Fingering`

### 6.2 Purpose

Allow the learner to hear the correct passage and rehearse the fingering sequence at the original tempo while temporarily removing tone production, articulation, breath coordination and full performance pressure.

### 6.3 Appropriate when

- the passage or rhythm may be unfamiliar;
- rushing begins during dense note movement;
- the learner may not anticipate the pitch or fingering sequence;
- a high-register or register-change passage is involved;
- the initial cause is broad or uncertain;
- the student chooses this option from the general front door.

### 6.4 Required assets

- original MusicXML passage;
- target-tempo reference audio;
- highlighted score cursor;
- optional fingering display when instrument-specific fingering data are available;
- count-in;
- immediate target-tempo performance task;
- baseline and post-intervention timing comparison;
- learner self-report prompt.

### 6.5 Interaction sequence

1. Play the target passage at the original target tempo.
2. Ask the learner to shadow-finger the passage while listening.
3. Ask whether any location felt unclear or difficult to follow.
4. Immediately perform the original passage at target tempo.
5. Compare the result with baseline.
6. Repeat the listen-shadow-perform cycle once.
7. Interpret the two-attempt response.

Do not treat passive listening alone as an attempt. Each cycle must end with active transfer to the instrument.

### 6.6 Evidence generated

| Observed response | Hypothesis update |
|---|---|
| Subsequent performance improves substantially | Familiarity, aural representation or movement preparation contributed |
| Learner reports losing the fingering sequence at the same location | Local fingering, note-reading or register hypothesis strengthens |
| Shadow fingering feels secure but sounding performance continues to rush | Tone production, articulation, breath, pulse or full coordination remains possible |
| Improvement occurs once but is not repeated | Support produced temporary performance change; internalisation remains uncertain |
| No meaningful change across two active transfer attempts | Pivot to Tempo Reduction with Strong Click unless targeted evidence indicates another route |

The system must not infer that one exact cause has been proven. Reference and shadow fingering change several demands simultaneously.

### 6.7 Continue, pivot and refer rules

- Continue when improvement is repeated across both transfer attempts.
- Remove the reference and retest once when target-tempo performance becomes stable.
- Pivot after two attempts with no meaningful improvement.
- Isolate a persistent location when the same note or transition fails repeatedly.
- Refer after two or three focused attempts on the isolated problem without improvement.

## 7. First-line diagnostic intervention 2

### 7.1 Name

`DI-SLOW-CLICK-01 Tempo Reduction with Strong Click`

### 7.2 Purpose

Reduce overall execution and processing demand while supplying a clear temporal reference. Use the resulting error pattern to distinguish global overload from persistent rhythmic or local execution problems.

### 7.3 Default configuration

- target tempo retained in session data;
- first reduced tempo: target minus 20 BPM;
- maximum initial general attempts: 3;
- continuous beat click;
- subdivision click only when the score or prior evidence supports its use;
- original notes and written rhythm retained;
- articulation retained initially unless it is already the suspected source;
- configurable minimum tempo and adaptive reduction.

Do not automatically add subdivision clicks to every rushing case. A strong beat click and a subdivision grid are separate support variables.

### 7.4 Interaction sequence

1. Explain that the tempo will be reduced to reveal what becomes stable and what remains difficult.
2. Perform the original passage 20 BPM below target with a strong beat click.
3. Compare timing drift, misses, error locations and learner judgement with baseline.
4. Repeat up to two additional times when improvement is occurring.
5. Classify the response pattern.
6. Continue the tempo strategy, pivot to a targeted intervention or refer the persistent issue.

### 7.5 Evidence generated

| Observed response | Hypothesis update and route |
|---|---|
| Rushing and most errors disappear | Target-tempo demand or general coordination threshold contributed; begin Tempo Ladder |
| Rushing disappears but complex rhythm remains inaccurate | RC04 Subdivision or RC05 Pattern Representation strengthens; use Listen-Echo, tapping or Explicit Subdivision |
| Same one or two notes repeatedly fail | Local execution bottleneck strengthens; isolate the notes or transition |
| Error clusters around high notes | Register, embouchure preparation, fingering or anticipation becomes plausible; do not label anxiety without learner/teacher evidence |
| Slurred version succeeds after written articulation fails | Articulation coordination strengthens; use Articulation Reduction |
| Passage stabilises with strong click but rushing returns when click density reduces | RC03 Internal Pulse strengthens; use Sparse Metronome or Gap Click |
| Passage remains globally unstable at reduced tempo with click | Representation, synchronisation or broad execution difficulty remains; use a targeted probe or Refer if evidence is insufficient |

### 7.6 Tempo restoration

When the reduced-tempo passage becomes stable:

1. require repeated control at the current tempo;
2. increase through configurable increments;
3. repeat once after a single failure;
4. regress after repeated failure;
5. record the stable and unstable tempo region;
6. restore target tempo;
7. fade continuous click support;
8. retest the original passage.

## 8. Learner choice

### 8.1 When choice is available

Allow the learner to choose between the two general first-line interventions when both are reasonable.

Suggested learner-facing wording:

> The passage is gradually speeding up. Which would you like to try first?

Option A:

> Listen and finger through it at the original tempo. This can help if the rhythm, notes or fingering do not yet feel familiar.

Option B:

> Try it 20 BPM slower with a stronger click. This can help if the passage feels too fast to coordinate comfortably.

### 8.2 System recommendation

AIPC should recommend one option while retaining learner choice unless a teacher setting or strong evidence requires a targeted route.

| Initial evidence | Recommended option |
|---|---|
| Error begins in dense pitch movement | Reference with Shadow Fingering |
| Unfamiliar rhythmic or note sequence | Reference with Shadow Fingering |
| Learner reports uncertainty about notes/fingering | Reference with Shadow Fingering |
| General instability across the phrase | Tempo Reduction with Strong Click |
| Many target-tempo misses | Tempo Reduction with Strong Click |
| Clear speed threshold | Tempo Reduction with Strong Click |
| Mixed evidence | Present both without a strong default |

### 8.3 SRL data

Store:

- option recommended by AIPC;
- recommendation reason;
- option chosen by learner;
- learner's optional reason;
- learner's prediction;
- measured result;
- learner judgement before automated feedback;
- next choice after feedback.

Learner choice must influence the sequence but must not disable safety, teacher constraints or referral rules.

## 9. Diagnostic profile

Implement a multi-label diagnostic profile rather than one confirmed root-cause field.

Suggested TypeScript model:

```ts
type EvidenceDirection = "strengthens" | "weakens" | "neutral" | "uncertain";

type EvidenceSource =
  | "baseline_performance"
  | "score_context"
  | "learner_report"
  | "teacher_annotation"
  | "diagnostic_intervention"
  | "targeted_probe"
  | "original_context_retest";

interface DiagnosticEvidence {
  id: string;
  source: EvidenceSource;
  interventionId?: string;
  attemptId?: string;
  capacityId: string;
  direction: EvidenceDirection;
  weight: number;
  observation: string;
  metrics?: Record<string, number | string | boolean>;
  createdAt: string;
}

interface CapacityHypothesis {
  capacityId: string;
  label: string;
  evidenceScore: number;
  confidence: "low" | "moderate" | "high";
  status: "possible" | "leading" | "reduced" | "unresolved";
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
}

interface DiagnosticProfile {
  problemSignatureId: string;
  hypotheses: CapacityHypothesis[];
  evidence: DiagnosticEvidence[];
  persistentLocations: PassageLocation[];
  unresolvedQuestions: string[];
  updatedAt: string;
}
```

Do not expose numerical evidence scores to the learner. They may be visible in teacher or research views.

## 10. Diagnostic intervention registry

Extend each strategy record with diagnostic metadata.

```ts
interface DiagnosticInterventionDefinition {
  id: string;
  strategyIds: string[];
  name: string;
  applicableProblemSignatures: string[];
  candidateCapacities: string[];
  variablesAdded: string[];
  variablesRemoved: string[];
  variablesPreserved: string[];
  pedagogicalPurpose: string;
  diagnosticPurpose: string;
  expectedResponses: ExpectedResponseRule[];
  maxInitialAttempts: number;
  continueRule: DecisionRule;
  pivotRule: DecisionRule;
  referRule: DecisionRule;
  supportFadePlan?: SupportFadePlan;
  originalContextRetestRequired: boolean;
}

interface ExpectedResponseRule {
  id: string;
  condition: MetricConditionGroup;
  evidenceUpdates: EvidenceUpdate[];
  recommendedNextActions: string[];
}
```

Required initial registry entries:

- `DI-REF-SHADOW-01`
- `DI-SLOW-CLICK-01`
- Gap Click as diagnostic intervention
- X-ray Rhythm as diagnostic intervention
- Transition Isolation as diagnostic intervention
- Articulation Reduction as diagnostic intervention
- Explicit Subdivision as diagnostic intervention
- Burst Practice as diagnostic intervention

## 11. First-line router

Suggested output:

```ts
interface FirstLineRecommendation {
  routeType: "general_choice" | "system_recommended" | "targeted_bypass";
  recommendedInterventionId: string;
  alternativeInterventionIds: string[];
  reason: string;
  evidenceIds: string[];
  teacherOverrideAvailable: boolean;
  learnerChoiceAvailable: boolean;
}
```

Router sequence:

1. Read problem signature, score context, baseline metrics and teacher constraints.
2. Check targeted-bypass rules.
3. If a targeted rule has adequate evidence, return `targeted_bypass`.
4. Otherwise score the two general first-line options.
5. If scores are close, return `general_choice`.
6. If one is more suitable, return `system_recommended` with the other as an alternative.
7. Store the reason and supporting evidence.

Do not encode this as a single large component conditional. Use data-driven routing rules that can be edited without changing the interface layer.

## 12. Response interpreter

The response interpreter compares:

- baseline performance;
- supported performance;
- repeated supported attempts;
- learner report;
- score locations;
- restoration or fading attempts;
- original-context retest.

Required response categories:

```ts
type InterventionResponse =
  | "substantial_repeated_improvement"
  | "partial_improvement"
  | "temporary_improvement"
  | "no_meaningful_change"
  | "persistent_rhythm_error"
  | "persistent_local_note_error"
  | "persistent_articulation_error"
  | "support_dependent_improvement"
  | "worsened"
  | "insufficient_data";
```

Improvement thresholds must be configurable and problem-specific. Compare change against baseline rather than relying only on an absolute accuracy score.

## 13. Decision controller

Replace a three-outcome loop with four decisions.

### Pass

Use when:

- the original passage meets the problem-specific success criterion;
- required support has been removed;
- success is repeatable.

### Persist

Use when:

- the selected intervention produces measurable improvement;
- the learner has not exceeded the attempt limit;
- the same strategy remains pedagogically justified.

### Pivot

Use when:

- a persistent pattern points towards a more specific intervention;
- improvement is partial and another contributor remains;
- the strategy produces no meaningful change after its attempt limit;
- the support itself masks the problem;
- a targeted intervention has greater expected value.

### Refer

Use when:

- the same isolated problem persists after two or three focused attempts;
- the cause requires teacher observation unavailable to AIPC;
- onset input is unreliable;
- pain, unsafe technique or physical distress is reported;
- high-register or embouchure problems remain unresolved;
- hypotheses remain contradictory;
- the system cannot recommend a bounded next action confidently.

## 14. Teacher handoff

Create a concise teacher-facing record.

```ts
interface TeacherHandoffRecord {
  studentId: string;
  assignmentId?: string;
  passageId: string;
  problemSignatureId: string;
  baselineSummary: string;
  interventionsAttempted: Array<{
    interventionId: string;
    attempts: number;
    response: InterventionResponse;
  }>;
  persistentLocations: PassageLocation[];
  leadingHypotheses: CapacityHypothesis[];
  learnerReport?: string;
  reasonForReferral: string;
  suggestedTeacherCheck: string[];
  supportingAttemptIds: string[];
  createdAt: string;
}
```

Learner-facing wording:

> This section is still causing difficulty after a few focused attempts. I have saved what we tried and where the problem remains so your teacher can review it with you.

Avoid failure language and avoid generating indefinite additional repetitions.

## 15. Progressive rushing reference implementation

### 15.1 Detection

Preserve `PS-RUSH-01` detection from onset telemetry and score alignment.

Do not change the numerical trigger as part of this refactor unless separately instructed. Keep trigger values configurable.

### 15.2 Initial profile

On detection, create provisional hypotheses such as:

- RC03 Internal Pulse;
- RC04 Subdivision;
- RC05 Pattern Representation;
- RC08 Instrumental Rhythmic Execution;
- RC02 Beat Synchronisation where continuous-click evidence supports it.

Use score and baseline context to initialise evidence:

- global drift;
- rhythmic complexity;
- note density;
- repeated local transitions;
- articulation density;
- register changes;
- error concentration;
- performance history;
- teacher annotation;
- learner report.

### 15.3 Routing example

```text
PS-RUSH-01 detected
    -> inspect score and baseline context
    -> targeted bypass available?
        -> yes: launch targeted diagnostic intervention
        -> no: recommend or offer general first-line choice
            -> Reference Listening with Shadow Fingering
            OR
            -> Tempo Reduction with Strong Click
    -> perform no more than initial attempt limit
    -> interpret what improves and persists
    -> update multi-label diagnostic profile
    -> Pass / Persist / Pivot / Refer
    -> fade support and restore original conditions
    -> original-passage retest
```

### 15.4 Example response chain

```text
Baseline:
Progressive rushing begins in dense high-register semiquavers.

Learner choice:
Reference Listening with Shadow Fingering.

Response:
Learner loses shadow fingering twice at the same transition.
Target-tempo playing continues to rush at that location.

Diagnostic update:
RC08 strengthened.
RC05 remains possible but secondary.

Pivot:
Short-Cell Transition Isolation at reduced tempo.

Response:
Transition remains inaccurate after three focused attempts.

Decision:
Refer to teacher with passage location, attempts and onset evidence.
```

### 15.5 Alternative response chain

```text
Baseline:
Progressive rushing occurs throughout a rhythmically simple phrase.

System recommendation:
Tempo Reduction with Strong Click.

Response:
Passage becomes stable 20 BPM below target.
Tempo is restored gradually.
Rushing returns only when click density is reduced.

Diagnostic update:
RC03 strengthened.

Pivot:
Sparse Metronome -> Gap Click.

Outcome:
Silent-period drift stabilises.
Original passage succeeds at target tempo without continuous click.

Decision:
Pass.
```

## 16. Learner interface requirements

### 16.1 Problem statement

Describe observation rather than inferred cause:

> You gradually moved ahead of the pulse in this section.

### 16.2 Choice screen

When the general front door applies, present no more than two primary choices. Each choice must include one sentence explaining when it may help.

### 16.3 Attempt screen

Show:

- current task;
- target passage;
- tempo;
- support being provided;
- attempt count;
- one monitoring focus.

Do not show RC codes to learners by default.

### 16.4 Reflection prompt

Before revealing full system feedback, ask one short question:

- What became easier?
- Where did the rushing begin?
- Did the click help you stay steady?
- Did the same notes remain difficult?

### 16.5 Feedback

Report:

- what improved;
- what remained;
- why the next action was selected.

Example:

> Slowing down removed most of the rushing, but the same two notes remained late. We will isolate that transition rather than repeat the whole passage.

## 17. Teacher controls

Teachers must be able to:

- enable or disable learner choice;
- set the default tempo reduction;
- set minimum tempo;
- limit attempts;
- approve or exclude strategies;
- force a targeted first-line intervention;
- define referral conditions;
- review diagnostic evidence;
- edit the final interpretation;
- distinguish intentional expressive timing from error;
- return a revised practice instruction to the learner.

## 18. Logging and analytics

For each intervention cycle, log:

- problem signature;
- baseline metrics;
- provisional hypotheses;
- first-line recommendation;
- recommendation reason;
- learner choice;
- intervention parameters;
- each attempt result;
- learner judgement;
- response classification;
- evidence updates;
- decision outcome;
- pivot path;
- support-fading history;
- original-context retest;
- teacher referral or teacher response.

Do not treat the learner's chosen option as evidence of the actual root cause. It is evidence of learner perception and strategy preference.

## 19. Migration plan

### Phase 1: data and compatibility

1. Add diagnostic profile and evidence models.
2. Extend existing strategy records with diagnostic metadata.
3. Preserve existing problem-signature IDs and attempt records.
4. Add migration defaults for older records.
5. Keep the present fixed route available behind a temporary feature flag.

### Phase 2: new first-line interventions

1. Implement Reference Listening with Shadow Fingering.
2. Implement Tempo Reduction with Strong Click.
3. Add the learner choice screen.
4. Add response comparison against baseline.
5. Add configurable attempt limits.

### Phase 3: routing and decisions

1. Implement targeted-bypass rules.
2. Implement FirstLineRouter.
3. Implement ResponseInterpreter.
4. Add Pass, Persist, Pivot and Refer.
5. Add teacher handoff generation.

### Phase 4: strategy-as-probe migration

1. Add diagnostic metadata to Gap Click.
2. Add diagnostic metadata to X-ray Rhythm.
3. Add diagnostic metadata to Transition Isolation.
4. Add diagnostic metadata to Articulation Reduction.
5. Add diagnostic metadata to Explicit Subdivision.
6. Add diagnostic metadata to Burst Practice.
7. Remove fixed `problem -> strategy` assumptions after regression testing.

## 20. Acceptance tests

### Test 1: learner chooses reference first

Given progressive rushing with ambiguous cause:

- AIPC offers both general first-line options;
- learner chooses Reference Listening with Shadow Fingering;
- system runs two listen-shadow-perform cycles;
- repeated improvement leads to unsupported target-tempo retest;
- no fixed RC03 diagnosis is created.

### Test 2: reference does not help

Given no meaningful change after two active transfer attempts:

- system does not continue reference playback indefinitely;
- system recommends Tempo Reduction with Strong Click;
- response is compared with baseline;
- the pivot and reason are stored.

### Test 3: slower practice reveals persistent rhythm error

Given rushing resolves 20 BPM below target but one complex rhythm remains inaccurate:

- response is classified as `persistent_rhythm_error`;
- RC04 or RC05 is strengthened provisionally;
- system pivots to Listen-Echo, tapping or Explicit Subdivision;
- original passage remains unresolved until final retest.

### Test 4: slower practice reveals local note error

Given the same two notes fail across three reduced-tempo attempts:

- response is classified as `persistent_local_note_error`;
- system isolates the transition;
- after the focused attempt limit is reached without improvement, system selects Refer;
- teacher handoff contains location and attempt evidence.

### Test 5: strong click masks internal-pulse weakness

Given reduced-tempo performance is stable with a strong click but rushes after click reduction:

- RC03 is strengthened only after the support-removal evidence;
- system selects Sparse Metronome or Gap Click;
- continuous-click success alone does not resolve the problem.

### Test 6: targeted bypass

Given repeated post-tie re-entry errors with otherwise stable timing:

- system bypasses the two general options;
- X-ray Rhythm or Ghost Beat is selected;
- the routing reason is stored.

### Test 7: multi-factor case

Given reduced tempo improves global rushing but a local articulated transition remains unstable:

- RC08 and RC03 may both remain in the profile;
- system does not overwrite the profile with one root cause;
- Articulation Reduction or Transition Isolation is selected from remaining evidence;
- strategies and outcomes are logged separately.

### Test 8: learner choice and SRL

Given both general options are viable:

- learner can select either option;
- recommendation, choice, prediction and judgement are stored separately;
- system adapts from measured response rather than assuming the chosen strategy was correct.

### Test 9: original-context transfer

Given a simplified exercise succeeds:

- the problem remains open;
- original notes, rhythm, articulation and target tempo are restored;
- required support is removed;
- only the successful original-context retest permits Pass.

### Test 10: regression compatibility

- telemetry and MusicXML ingestion continue to work;
- all existing rhythm problem signatures remain detectable;
- current click and fading behaviour remains available;
- historical attempt records remain readable;
- teacher assignments and existing practice sessions do not break.

## 21. Non-goals for this refactor

- Do not claim neurological or psychological causes from onset telemetry.
- Do not infer anxiety from high-register errors without learner or teacher evidence.
- Do not rebuild the complete telemetry engine.
- Do not replace teacher judgement.
- Do not create a separate hard-coded component for every problem-strategy pair.
- Do not require all probes before intervention.
- Do not allow unlimited automatic repetitions.
- Do not treat support-dependent success as mastery.
- Do not expose diagnostic confidence scores to learners by default.

## 22. Completion criterion

The refactor is complete when AIPC can:

1. detect a rhythm problem using the existing telemetry;
2. maintain several provisional capacity hypotheses;
3. recommend or offer the two general first-line diagnostic interventions;
4. bypass them when a targeted intervention is better supported;
5. treat the learner's intervention response as diagnostic evidence;
6. select Pass, Persist, Pivot or Refer;
7. limit repeated unsuccessful attempts;
8. generate a useful teacher handoff;
9. fade support;
10. require successful transfer to the original musical passage.

