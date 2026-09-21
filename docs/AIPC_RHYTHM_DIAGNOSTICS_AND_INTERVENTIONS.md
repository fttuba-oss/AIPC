# AIPC Rhythmic Diagnostic & Intervention Architecture Specification

**Version:** 1.0  
**Domain:** Computational Music Pedagogy & Real-Time Rhythmic Telemetry  
**Target Capacities:** RC01 – RC10  
**Strategy Catalogue:** R01 – R32  

---

## 1. Executive Summary & Foundational Data Model

The AIPC Rhythmic Diagnostic Engine establishes a rigorous, closed-loop diagnostic and intervention pipeline. Rather than generating arbitrary score percentages, the engine maps physical performance telemetry (acquired via acoustic microphone onset detection or hardware tap devices) directly to underlying cognitive and motor rhythmic capacities.

### 1.1 Ingestion & Telemetry Alignment

For each musical event, the system extracts the physical onset and aligns it with the canonical ground-truth score representation:

```
[Student Performance] (Acoustic Mic / Spacebar / Screen Tap) ──> Detected Onset Time (t_onset)
[Score Notation]      (MusicXML / OSMD Tempo Map)           ──> Expected Note Time (t_expected)
                                                                            │
                                                                            ▼
                                                     Timing Offset: Δt = t_onset - t_expected (ms)
```

Where:
* $t_{\text{onset}}$: Timestamp of detected attack in seconds (relative to the playback/session transport timeline).
* $t_{\text{expected}}$: Nominal timestamp of the notehead calculated from the tempo map and metrical position:
  $$t_{\text{expected}} = \text{beatToSeconds}(\text{note.beat}, \text{tempos})$$
* $\Delta t = (t_{\text{onset}} - t_{\text{expected}}) \times 1000$ (in milliseconds).
  * $\Delta t < 0$: Early arrival (**Rushing**).
  * $\Delta t > 0$: Late arrival (**Dragging**).

### 1.2 Micro-Timing Windows & Categorical Rating

Individual note attacks are evaluated using cognitive perceptual thresholds:

| Rating | Timing Offset ($\Delta t$) | Cognitive Interpretation |
| :--- | :--- | :--- |
| **Perfect** | $|\Delta t| \le 45\text{ ms}$ | Within perceptual isochrony tolerance; fully synchronized motor planning. |
| **Good / Great** | $45\text{ ms} < |\Delta t| \le 125\text{ ms}$ | Functionally stable pulse alignment; minor perceptual fluctuation. |
| **Early** | $-260\text{ ms} \le \Delta t < -125\text{ ms}$ | Anticipatory motor release; rushing ahead of the reference timekeeper. |
| **Late** | $+125\text{ ms} < \Delta t \le +260\text{ ms}$ | Decelerated execution; drag caused by motor friction or weak internal anticipation. |
| **Miss** | No attack within $\pm 260\text{ ms}$ | Dropped rhythm, vocal/instrumental hesitation, or severe metrical dislocation. |

---

## 2. Core Controlled Vocabulary: Rhythmic Capacities (`RC01` – `RC10`)

The diagnostic framework maps observed anomalies to ten primary internal capacities:

1. **`RC01` Beat Perception:** Ability to extract and identify an isochronous pulse from an auditory or symbolic pattern.
2. **`RC02` Beat Synchronisation:** Predictive motor alignment with an active external acoustic pulse.
3. **`RC03` Internal Pulse (Pacemaker Autonomy):** Maintenance of an accurate, stable tempo when external click/backing support is removed.
4. **`RC04` Subdivision:** Precise mental partitioning of the beat into equal micro-intervals (eighths, triplets, sixteenths).
5. **`RC05` Pattern Representation:** Long-term and working memory encoding of duration relationships and rhythmic syntax.
6. **`RC06` Metrical Organisation:** Hierarchical organization of events across subdivision, beat, bar, and phrase boundaries (withstanding syncopation and ties).
7. **`RC07` Temporal Adaptation:** Rapid error correction (phase and period correction) in response to tempo variations.
8. **`RC08` Rhythmic Execution:** Instrumental/biomechanical realization of an understood rhythm (distinguishing motor friction from perceptual error).
9. **`RC09` Self-Monitoring & Recovery:** Real-time metacognitive detection of timing errors and spontaneous recovery without stopping.
10. **`RC10` Expressive Timing Control:** Deliberate, consistent expressive micro-deviations (rubato, tenuto) distinct from unintentional instability.

---

## 3. Diagnostic Problem Signatures, Detection Algorithms & Intervention Scaffolding

---

### Problem 1: Progressive Tempo Rushing (`PS-RUSH-01`)

* **Target Capacities:** `RC03` (Internal Pulse) or `RC08` (Instrumental Biomechanical Tension).
* **Auditory/Visual Manifestation:** The student accelerates continuously through phrases; note attacks systematically drift earlier relative to the metronome.

#### Detection Algorithm & Formula:
Collect the mean timing offset $\overline{\Delta t}_m$ for each measure $m \in \{1, 2, \dots, M\}$ across the attempt:
$$\overline{\Delta t}_m = \frac{1}{N_m} \sum_{i=1}^{N_m} \Delta t_{m, i}$$
Perform linear regression of $\overline{\Delta t}_m$ against measure index $m$:
$$\text{Drift Slope } (\beta) = \frac{\sum_{m=1}^M (m - \bar{m})(\overline{\Delta t}_m - \bar{\Delta t})}{\sum_{m=1}^M (m - \bar{m})^2}$$

* **Diagnostic Trigger:**
  $$\beta < -4.0\text{ ms/bar over } \ge 3 \text{ consecutive measures}$$
  OR $\ge 2$ early notes in a measure with $\text{mean offset} < -70\text{ ms}$.

#### Differential Diagnostic Probe:
* Compare rhythm execution on a **single pitch** vs. **full melody**:
  * If $Acc_{\text{single-pitch}} > 85\%$ and $Acc_{\text{melody}} < 65\%$, classify as **`RC08` Motor Load**.
  * If rushing persists on a single pitch, classify as **`RC03` Pacemaker Instability**.

#### Pedagogical Intervention & Scaffolding:
* **Selected Strategy (Clock):** **`R12` Gap-Click Practice** (Metronome Dropout) / **`R11` Sparse Metronome**.
* **Selected Strategy (Motor Load):** **`R03` Single-Pitch Reduction** $\rightarrow$ **`R22` Tempo Ladder**.
* **5-Level Fading Ladder:**
  * **Level 0 (Maximum Support):** Continuous click on every beat + audible subdivision click.
  * **Level 1 (High Support):** Metronome clicks on beats 1 and 3 only; student generates beats 2 and 4.
  * **Level 2 (Moderate Support):** Downbeat-only click (1 click per measure).
  * **Level 3 (Low Support - Gap Click):** 2 measures audible click $\rightarrow$ 2 measures complete silence. Re-entry offset must land within $\pm 45\text{ ms}$.
  * **Level 4 (Minimal Support):** 4 measures silent continuation.
  * **Level 5 (Unscaffolded Retest):** Full 8-to-16 measure passage performed with 0 click; drift slope $|\beta| < 1.5\text{ ms/bar}$.

---

### Problem 2: Progressive Tempo Dragging (`PS-DRAG-01`)

* **Target Capacities:** `RC03` (Internal Pulse) or `RC08` (Fingering/Embouchure Transit Friction).
* **Auditory/Visual Manifestation:** The tempo steadily decays; student falls progressively behind the beat, particularly across complex note passages.

#### Detection Algorithm & Formula:
Compute the linear regression slope $\beta$ of measure offsets:
$$\beta = \frac{\sum_{m=1}^M (m - \bar{m})(\overline{\Delta t}_m - \bar{\Delta t})}{\sum_{m=1}^M (m - \bar{m})^2}$$

* **Diagnostic Trigger:**
  $$\beta > +4.0\text{ ms/bar over } \ge 3 \text{ consecutive measures}$$
  OR $\ge 2$ late notes in a measure with $\text{mean offset} > +70\text{ ms}$.

#### Pedagogical Intervention & Scaffolding:
* **Selected Strategy (Motor Transit):** **`R16` Transition Isolation** $\rightarrow$ **`R22` Tempo Ladder**.
* **Selected Strategy (Pulse Deceleration):** **`R04` Tap Underlying Beat** + **`R10` Metronome Pulse Grounding**.
* **5-Level Fading Ladder:**
  * **Level 0:** Baseline tempo reduced by 20–25%; continuous downbeat & upbeat clicks.
  * **Level 1:** Speed increased by $+4\text{ BPM}$; continuous click.
  * **Level 2:** Speed increased by $+8\text{ BPM}$; clicks reduced to beats 1 and 3.
  * **Level 3:** Speed increased by $+12\text{ BPM}$; downbeat-only click.
  * **Level 4:** Target tempo reached with alternating 2 bars click / 2 bars silent.
  * **Level 5 (Unscaffolded Retest):** Target tempo with zero external acoustic support; no deceleration.

---

### Problem 3: Uneven Short Subdivisions (`PS-SUBDIV-01`)

* **Target Capacities:** `RC04` (Subdivision Mental Grid) & `RC05` (Pattern Representation).
* **Auditory/Visual Manifestation:** Sixteenth-note runs or triplets sound uneven, jerky, or "lumpy"; adjacent notes show compressed or expanded durations.

#### Detection Algorithm & Formula:
Collect the timing offset series $\Delta t_i$ specifically for notes with duration $\le$ eighth/sixteenth note values. Compute the **Standard Deviation of Onset Offsets ($\sigma_{\Delta t}$)** and the **Inter-Onset Interval Ratio Fluctuation**:
$$\sigma_{\Delta t} = \sqrt{\frac{1}{N-1} \sum_{i=1}^N (\Delta t_i - \bar{\Delta t})^2}$$
$$\text{Adjacent Disparity } (\delta_{\text{adj}}) = |\Delta t_{i+1} - \Delta t_i|$$

* **Diagnostic Trigger:**
  $$\sigma_{\Delta t} > 45\text{ ms on short note values}$$
  OR frequent alternating pairs where $\delta_{\text{adj}} > 75\text{ ms}$.

#### Differential Diagnostic Probe:
* Assess aural echo accuracy (**Listen-Echo** probe):
  * If student cannot speak or clap the subdivision correctly away from the instrument ($Acc < 70\%$), trigger **`R18` Reference Audio / Listen-Echo**.
  * If verbal/clap reproduction is clean, trigger **`R07` Explicit Subdivision Grid**.

#### Pedagogical Intervention & Scaffolding:
* **Selected Strategy:** **`R07` Explicit Subdivision** / **`R24` Rhythmic Variation (Dotted Practice)**.
* **5-Level Fading Ladder:**
  * **Level 0:** Audible high-frequency subdivision click sounding on every sixteenth/triplet sub-pulse (100% volume) + visual pulse grid.
  * **Level 1:** Subdivision clicks attenuated by $-6\text{ dB}$; primary downbeats loud.
  * **Level 2:** Subdivision clicks reduced to eighth-note grid only (half density).
  * **Level 3:** Quarter-note pulse only; student mentally generates inner subdivision lattice.
  * **Level 4:** Clicks muted on alternating measures.
  * **Level 5 (Unscaffolded Retest):** Full passage at target speed with $\sigma_{\Delta t} < 22\text{ ms}$ without clicks.

---

### Problem 4: Beat Loss Across Syncopation & Ties (`PS-SYNCOP-01`)

* **Target Capacities:** `RC06` (Metrical Organisation) & `RC04` (Subdivision).
* **Auditory/Visual Manifestation:** Offbeat entries or tied notes across barlines cause metric disorientation; the subsequent entry is displaced by an eighth or quarter beat.

#### Detection Algorithm & Formula:
Isolate the entry note immediately following a tied duration or an accented syncopated offbeat:
$$\Delta t_{\text{reentry}} = t_{\text{onset}} - t_{\text{expected}}$$

* **Diagnostic Trigger:**
  $$|\Delta t_{\text{reentry}}| > 160\text{ ms}$$
  specifically concentrated on the first note after a tie/rest, while straight passages exhibit $|\Delta t| < 50\text{ ms}$.

#### Pedagogical Intervention & Scaffolding:
* **Selected Strategy:** **`R20` Ghost Beat / X-Ray Rhythm** (Making latent metric lattice audible by articulating through the tied duration).
* **5-Level Fading Ladder:**
  * **Level 0 (Audible Ghost Notes):** The tied note is re-articulated aloud on every beat and subdivision it spans; underlying pulse clicks sound continuously.
  * **Level 1 (Subvocalized Ghost Notes):** Tied note is re-articulated using a soft whisper tongue or silent finger tap on instrument keys.
  * **Level 2 (Scaffolded Sustained):** Tied note is held normally, but an audible click sounds explicitly *inside* the duration of the tie.
  * **Level 3 (Downbeat Reference):** Metronome sounds only on the downbeat of the tied measure.
  * **Level 4 (Visual Anchor):** Click removed; visual pulse indicator pulses through the tie.
  * **Level 5 (Unscaffolded Retest):** Passage performed in musical context; entry following the tie lands with $|\Delta t| \le 40\text{ ms}$.

---

### Problem 5: Metronome Dependency & Click Removal Drift (`PS-GAP-01`)

* **Target Capacities:** `RC03` (Internal Pulse) & `RC02` (Beat Synchronisation).
* **Auditory/Visual Manifestation:** Performance is accurate when an external click is sounding, but tempo collapses, rushes, or stumbles the moment the click is removed.

#### Detection Algorithm & Formula:
In a 4-bar alternating session (2 bars metronome ON, 2 bars metronome SILENT), measure accuracy during the gap and the phase error on the re-entry click:
$$\text{Accuracy Drop} = Acc_{\text{click}} - Acc_{\text{silent}}$$
$$\text{Reentry Error} = |t_{\text{first note after gap}} - t_{\text{click boundary}}|$$

* **Diagnostic Trigger:**
  $$\text{Accuracy Drop} > 35\% \quad \text{OR} \quad \text{Reentry Error} > 75\text{ ms}$$

#### Pedagogical Intervention & Scaffolding:
* **Selected Strategy:** **`R12` Gap-Click Practice** / **`R13` Synchronisation-Continuation**.
* **5-Level Fading Ladder:**
  * **Level 0:** Continuous click (100% audible).
  * **Level 1:** 3 measures click, 1 measure silent gap.
  * **Level 2:** 2 measures click, 2 measures silent gap.
  * **Level 3:** 1 measure click, 3 measures silent gap.
  * **Level 4:** 8 consecutive measures silent continuation before single check-in click.
  * **Level 5 (Unscaffolded Retest):** 16 measures unassisted continuation; re-entry arrival within $\pm 35\text{ ms}$.

---

### Problem 6: Velocity-Dependent Motor Collapse (`PS-EXEC-01`)

* **Target Capacities:** `RC08` (Rhythmic Execution) & `RC07` (Temporal Adaptation).
* **Auditory/Visual Manifestation:** Student plays accurately at 75–85 BPM, but timing falls apart, notes drop, or finger stutters occur as tempo approaches target (115–120 BPM).

#### Detection Algorithm & Formula:
Execute contrastive tempo evaluations at baseline speed ($70\%\text{ BPM}$) vs. target speed ($100\%\text{ BPM}$):
$$\text{Variability Ratio} = \frac{\sigma_{\Delta t}(\text{Target BPM})}{\sigma_{\Delta t}(\text{Slow BPM})}$$
$$\text{Miss Surge} = \text{MissCount}(\text{Target}) - \text{MissCount}(\text{Slow})$$

* **Diagnostic Trigger:**
  $$\text{Variability Ratio} > 2.0\times \quad \text{OR} \quad \text{Miss Surge} \ge 3 \text{ notes}$$

#### Pedagogical Intervention & Scaffolding:
* **Selected Strategy:** **`R22` Tempo Ladder** + **`R23` Burst Practice**.
* **5-Level Fading Ladder:**
  * **Level 0:** Baseline comfortable tempo ($70\%\text{ BPM}$) with requirement of 2 consecutive trials at $\ge 90\%$ accuracy.
  * **Level 1:** $+4\text{ to } +6\text{ BPM}$ progression increment.
  * **Level 2:** Target tempo introduced in **short 3-to-4 note bursts** followed by rest bars.
  * **Level 3:** Half-phrase executed at target speed $-4\text{ BPM}$.
  * **Level 4:** Full phrase at target speed with subdivision click assistance.
  * **Level 5 (Unscaffolded Retest):** Full phrase at 100% target tempo without assistance; $\sigma_{\Delta t} < 25\text{ ms}$.

---

### Problem 7: Localized Transition Bottleneck (`PS-TRANS-01`)

* **Target Capacities:** `RC08` (Instrumental Biomechanics).
* **Auditory/Visual Manifestation:** Rhythmic timing is consistent throughout the measure except across one specific finger change, awkward cross-fingering, or register shift.

#### Detection Algorithm & Formula:
Calculate the local $z$-score of timing offset for note transition $k$:
$$z_k = \frac{|\Delta t_k - \bar{\Delta t}|}{\sigma_{\Delta t}}$$

* **Diagnostic Trigger:**
  $$z_k > 3.0 \quad \text{(Statistically significant local timing outlier)}$$
  located at a registered interval leap or cross-finger transition.

#### Pedagogical Intervention & Scaffolding:
* **Selected Strategy:** **`R16` Transition Isolation**.
* **5-Level Fading Ladder:**
  * **Level 0:** 2-note seam isolated into a continuous slow repetition loop; slurred without tonguing load.
  * **Level 1:** 2-note loop performed at written articulation and rhythm at 80% tempo.
  * **Level 2:** Context expanded to 4 notes (1 note before and 1 note after the seam).
  * **Level 3:** Single complete measure containing the transition.
  * **Level 4:** Measure preceding into the transition measure.
  * **Level 5 (Unscaffolded Retest):** Full musical section; transition executes seamlessly without micro-hesitation.

---

## 4. Master Diagnostic-Intervention Mapping Matrix

| Signature ID | Problem Name | Primary Metric | Mathematical Trigger | Selected Strategy | Scaffold Dimension | Level 5 Retest Criterion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`PS-RUSH-01`** | Progressive Rushing | `drift_slope` ($\beta$) | $\beta < -4.0\text{ ms/bar}$ | **`R12` Gap-Click** / **`R03` Single Pitch** | Metronome density & pitch load | Stable tempo over 8 silent bars ($|\beta| < 1.5$) |
| **`PS-DRAG-01`** | Progressive Dragging | `drift_slope` ($\beta$) | $\beta > +4.0\text{ ms/bar}$ | **`R22` Tempo Ladder** / **`R04` Tap Pulse** | Pulse anchoring & tempo steps | Zero deceleration at target BPM |
| **`PS-SUBDIV-01`** | Uneven Subdivisions | `variability` ($\sigma$) | $\sigma > 45\text{ ms}$ on 16ths/triplets | **`R07` Explicit Subdivision** | Micro-grid acoustic volume | $\sigma < 22\text{ ms}$ on 16th runs |
| **`PS-SYNCOP-01`** | Syncopation / Tie Loss | `reentry_error` | $|\Delta t| > 160\text{ ms}$ after tie/offbeat | **`R20` Ghost Beat** | Metric lattice audibility | Clean offbeat landing ($\le 40\text{ ms}$) without aids |
| **`PS-GAP-01`** | Click Dependency | `reentry_jump` | $\Delta t > 75\text{ ms}$ after silence | **`R12` Gap-Click** / **`R13` Continuation** | Silent gap bar length | $\le 35\text{ ms}$ re-entry error after 4 bars |
| **`PS-EXEC-01`** | Velocity Collapse | `variability_ratio` | $\sigma_{\text{target}} / \sigma_{\text{slow}} > 2.0\times$ | **`R22` Tempo Ladder** / **`R23` Burst** | Tempo ramping & cell duration | $90\%+$ accuracy at target BPM |
| **`PS-TRANS-01`** | Transition Bottleneck | `local_outlier` ($z$) | $z_k > 3.0$ at specific transition | **`R16` Transition Isolation** | Cell size (2 notes $\rightarrow$ full bar) | Seam flows without localized delay |

---

## 5. Architectural Corrective Actions for Portal Implementation

To prevent false 100% accuracy reports and ensure seamless telemetry:

1. **Eliminate False 100% Fallback:**
   In [rhythmDiagnosticEngine.ts](file:///c:/Users/fttub/Documents/AIPC%20teacher%20portal/src/diagnostics/rhythmDiagnosticEngine.ts#L194-L196), change:
   ```typescript
   // Old buggy fallback:
   const overallAccuracyPercent = totalAssessed > 0 ? Math.round((successfulHits / totalAssessed) * 100) : 100;

   // Corrected telemetry:
   const overallAccuracyPercent = totalAssessed > 0 ? Math.round((successfulHits / totalAssessed) * 100) : 0;
   ```
2. **AudioContext User Gesture Arming:**
   Ensure `AudioContext.resume()` is bound to the practice/recording start button click rather than unprompted component mount, avoiding browser suspended-audio lockouts.
3. **Harmonize Rest Indexing in Coach Modal:**
   Align `noteTapsRecord` indices to active sounded notes ($!n.isRest$) to eliminate offset mismatches between the playback engine queue and assessment scoring.

---

## 6. Cross-Rhythm, Polyrhythm & Asymmetric Metre Knowledgebase

*Scientific foundations, operational taxonomy, MusicXML schemas, diagnostic signatures, and adaptive intervention scaffolding derived from AIPC Cross-Rhythm Science & Pedagogy.*

### 6.1 Scientific & Motor-Control Foundations

1. **Hierarchical Metrical Attention & Predictive Coding (Large & Jones; Vuust & Witek):**
   - Musicians do not track onsets as isolated timestamps; they continuously generate internal predictive temporal grids (entrainment).
   - In cross-rhythm, the performer must preserve an endogenous reference metre while generating or perceiving a competing periodicity. If the reference is weak, **attentional capture** occurs, and the counter-rhythm usurps the downbeat.
2. **Bimanual Motor Attraction & Phase Transitions (Haken-Kelso-Bunz; Swinnen):**
   - Human motor systems naturally tend toward stable in-phase (0°) or anti-phase (180°) coordination.
   - Non-coincident attacks in coprime ratios (e.g. 3:2, 4:3) naturally drift toward synchrony (**motor assimilation**) or collapse into an uneven single-stream shuffle.
3. **Common Subdivision Grid (LCM) & Its Limits:**
   - For an $m:n$ coprime ratio, a cycle can be represented by $m \times n$ equal slots.
   - While effective for 2:3 (6 slots) and 3:4 (12 slots) during initial acquisition, counting 20 slots (4:5) or 35 slots (5:7) creates excessive cognitive load and mechanical playing. The AIPC engine must use the grid as temporary scaffolding and rapidly transition to circular phase models and auditory-motor chunking.

---

### 6.2 The Six Rhythmic Entities: Definitions & MusicXML Architecture

```
                                  RHYTHMIC ENTITIES
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
   [TUPLETS]                       [POLYRHYTHM]                       [CROSS-RHYTHM]
Single stream: N in              2+ concurrent streams:           Recurrent accent/grouping
time of M (e.g. 3:2, 5:4)        conflicting simultaneous         conflicts with established
within prevailing pulse          subdivisions (e.g. 3 vs 2)       reference beat cycle
        │                                 │                                 │
        ▼                                 ▼                                 ▼
   [HEMIOLA]                       [POLYMÈTRE]                   [ADDITIVE GROUPING]
3:2 or 2:3 re-grouping           Layers project different         Asymmetric pulse clumps
across bar/phrase level          metric cycles/barlengths         (e.g. 3+2+2 in 7/8);
(e.g. 2 bars 3/4 -> 1 bar 3/2)   (e.g. 3/4 against 4/4)           no simultaneous ratio
```

#### 1. Tuplet Ratio ($m:n$)
* **Definition:** A prescribed number of equal events ($m$) occupies the exact duration normally assigned to another number ($n$) within a prevailing metric stream.
* **MusicXML Encoding:**
  - `<time-modification>` element with `<actual-notes>` and `<normal-notes>`.
  - Visual brackets via `<notations><tuplet type="start"/><tuplet type="stop"/></notations>`.
  - Duration calculation: $\text{Duration} = \text{divisions} \times \frac{\text{normal-notes}}{\text{actual-notes}}$.
* **Example (Quarter-note triplet in 4/4, divisions = 24):**
  ```xml
  <note>
    <pitch><step>C</step><octave>4</octave></pitch>
    <duration>16</duration>
    <type>quarter</type>
    <time-modification>
      <actual-notes>3</actual-notes>
      <normal-notes>2</normal-notes>
    </time-modification>
    <notations><tuplet type="start" bracket="yes"/></notations>
  </note>
  ```

#### 2. Polyrhythm (Simultaneous $m:n$)
* **Definition:** Two or more rhythm streams operating simultaneously within the exact same time span, dividing that span into contrasting, coprime subdivisions.
* **MusicXML Encoding:**
  - Single part: Voice 1 encodes Layer A; a `<backup>` tag rewinds the playhead by the measure duration; Voice 2 encodes Layer B.
  - Multi-part: Concurrent parts aligned by measure boundaries.
* **Example (3 against 2 in 2/4, divisions = 6, total = 12 divisions):**
  ```xml
  <!-- Voice 1: Two regular quarters -->
  <note><pitch><step>C</step><octave>5</octave></pitch><duration>6</duration><voice>1</voice><type>quarter</type></note>
  <note><pitch><step>C</step><octave>5</octave></pitch><duration>6</duration><voice>1</voice><type>quarter</type></note>
  <!-- Rewind playhead -->
  <backup><duration>12</duration></backup>
  <!-- Voice 2: Three triplet quarters -->
  <note><pitch><step>G</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><type>quarter</type>
    <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
    <notations><tuplet type="start" bracket="yes"/></notations>
  </note>
  <note><pitch><step>G</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><type>quarter</type>
    <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
  </note>
  <note><pitch><step>G</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><type>quarter</type>
    <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
    <notations><tuplet type="stop"/></notations>
  </note>
  ```

#### 3. Cross-Rhythm
* **Definition:** A recurring grouping, accent structure, or attack cycle that directly conflicts with, and is heard against, an established, sustained metrical reference. The primary metre is maintained while producing the counter-cycle.
* **MusicXML Encoding:**
  - Repeated dotted values or syncopations tied across beats and barlines (`<tie type="start"/>`, `<tie type="stop"/>`).
  - Explicit metric accents on syncopated onsets (`<notations><articulations><accent/></articulations></notations>`).
* **Example (3-eighth grouping across 4/4 measure):**
  ```xml
  <note><pitch><step>C</step><octave>4</octave></pitch><duration>6</duration><type>quarter</type><dot/><notations><articulations><accent/></articulations></notations></note>
  <note><pitch><step>E</step><octave>4</octave></pitch><duration>6</duration><type>quarter</type><dot/><notations><articulations><accent/></articulations></notations></note>
  <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type><tie type="start"/><notations><tied type="start"/><articulations><accent/></articulations></notations></note>
  ```

#### 4. Hemiola
* **Definition:** A specific $3:2$ or $2:3$ relationship spanning across measure or phrase boundaries. Classically: two bars of triple metre ($3/4 + 3/4 = 6$ beats) re-chunked as three duple units ($2 + 2 + 2$ beats) without changing the underlying pulse tempo.
* **MusicXML Encoding:**
  - Two consecutive 3/4 measures where notes are tied across the central barline, forming three 2-beat half notes.
* **Example (Cadential Hemiola in 3/4):**
  ```xml
  <!-- Bar 1: Pulse 1 (half note = 2 beats), Pulse 2a (quarter = 1 beat, tied) -->
  <measure number="1">
    <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><type>half</type><notations><articulations><accent/></articulations></notations></note>
    <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type><tie type="start"/><notations><tied type="start"/></notations></note>
  </measure>
  <!-- Bar 2: Pulse 2b (quarter = 1 beat, tied), Pulse 3 (half note = 2 beats) -->
  <measure number="2">
    <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type><tie type="stop"/><notations><tied type="stop"/></notations></note>
    <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>half</type><notations><articulations><accent/></articulations></notations></note>
  </measure>
  ```

#### 5. Polymetre
* **Definition:** Simultaneous layers projecting different metric cycles or bar structures (e.g. Part 1 in 3/4 while Part 2 is in 4/4 with equal quarter-note speeds). Downbeats coincide only after the lowest common multiple of beats (every 12 beats).
* **MusicXML Encoding:**
  - Independent `<time>` elements declared inside each `<part>`.
  - Alternatively notated in compound meter (12/8) with conflicting beaming structures.
* **Example:**
  ```xml
  <part id="P1"><measure number="1"><attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>...</measure></part>
  <part id="P2"><measure number="1"><attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes>...</measure></part>
  ```

#### 6. Additive Grouping (Asymmetric Metre)
* **Definition:** A single rhythmic stream with pulses grouped asymmetrically into constituent units of 2s and 3s ($3+2$, $2+3$, $2+2+3$, $3+3+2$). This is a sequential asymmetric pulse, not a simultaneous ratio.
* **MusicXML Encoding:**
  - `<time>` with composite beats (`<beats>3+2</beats>`).
  - Explicit asymmetric `<beam>` sequences clumping the 3-pulse and 2-pulse units.
* **Example (5/8 as $3+2$):**
  ```xml
  <attributes><time><beats>3+2</beats><beat-type>8</beat-type></time></attributes>
  <!-- 3 eighths beamed together -->
  <note><duration>2</duration><type>eighth</type><beam number="1">begin</beam></note>
  <note><duration>2</duration><type>eighth</type><beam number="1">continue</beam></note>
  <note><duration>2</duration><type>eighth</type><beam number="1">end</beam></note>
  <!-- 2 eighths beamed together -->
  <note><duration>2</duration><type>eighth</type><beam number="1">begin</beam></note>
  <note><duration>2</duration><type>eighth</type><beam number="1">end</beam></note>
  ```

---

### 6.3 Extended Rhythmic Capacities (`RC11` – `RC13`)

To evaluate cross-rhythms and polyrhythms, the diagnostic engine expands from 10 to 13 capacities:

* **`RC11` Dual-Stream Phase Independence:** Ability to sustain two competing rhythmic periodicities concurrently (bimanually or against accompaniment) without involuntary motor coupling or assimilation.
* **`RC12` Metrical Anchor Stability under Counter-Periodicity:** Ability to preserve cognitive and physical orientation to the primary reference beat and cycle start when strong cross-accents or syncopated timeline patterns enter.
* **`RC13` Asymmetric Additive Chunking:** Ability to internalize and execute irregular macro-beats ($2+3$, $3+2+2$) with organic timing, resisting the tendency to regularize them into symmetrical subdivisions.

---

### 6.4 Cross-Rhythm Diagnostic Problem Signatures & Algorithms

| Signature ID | Problem Name | Primary Metric | Mathematical Trigger | Target Capacity | First Intervention |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`PS-POLY-ASSIM-01`** | Polyrhythmic Motor Assimilation | Inter-Layer Offset ($\delta_{\text{pair}}$) | $|\Delta t_{\text{LayerA}} - \Delta t_{\text{LayerB}}| \to 0$ on non-coincident attacks | `RC11` | Coincidence point anchoring + LCM grid |
| **`PS-CROSS-CAP-01`** | Attentional Capture / Beat Loss | Reference Phase Error ($\phi_{\text{ref}}$) | $|\phi_{\text{ref}}| > 180\text{ ms}$ upon counter-entry | `RC12` | Beat stepping + single-stream counter isolation |
| **`PS-POLY-SHUF-01`** | Stream Disintegration (Shuffle) | IOI Ratio Variance ($\sigma_{\text{IOI}}$) | $\sigma_{\text{IOI}} / \mu_{\text{IOI}} > 0.35$ in either stream | `RC04` / `RC11` | Layer alternation & distinct timbres |
| **`PS-HEMIOLA-DISP-01`** | Hemiola Metric Fluctuation | Pulse Tempo Drift ($\Delta \text{BPM}_{\text{bar}}$) | $|\text{BPM}_{\text{hemiola}} - \text{BPM}_{\text{prev}}| > 8\%$ | `RC06` | Gross motor 3-pulse conducting |
| **`PS-ADD-REG-01`** | Additive Asymmetry Smoothing | Asymmetry Disparity Ratio | Ratio of 3-group to 2-group $\to 1.0$ | `RC13` | Subvocalized syllables (Taka-Takita) |

#### Detection Algorithm: Motor Assimilation (`PS-POLY-ASSIM-01`)
For polyrhythm $m:n$, let $t_{A, i}$ and $t_{B, j}$ be adjacent expected onsets in the two layers with nominal time separation $\tau_{\text{nom}} = |t_{A, i} - t_{B, j}| > 40\text{ ms}$ (non-coincident). Let $t'_{A, i}$ and $t'_{B, j}$ be the student's executed attacks:
$$\text{Coupling Ratio } (CR) = \frac{|t'_{A, i} - t'_{B, j}|}{\tau_{\text{nom}}}$$
* **Trigger:** If $CR < 0.45$ across $\ge 2$ cycles (attacks pulled together toward false synchrony), flag **`PS-POLY-ASSIM-01`**.

#### Detection Algorithm: Attentional Capture (`PS-CROSS-CAP-01`)
Measure the phase deviation of the student's reference pulse taps before vs. after the entry of the cross-rhythmic counter-melody:
$$\Delta \Phi = |\bar{\Delta t}_{\text{after}} - \bar{\Delta t}_{\text{before}}|$$
* **Trigger:** If $\Delta \Phi > 120\text{ ms}$ or if the student's pulse locks onto the period of the counter-rhythm, flag **`PS-CROSS-CAP-01`**.

---

### 6.5 The 10-Stage Pedagogical Intervention Ladder for Cross-Rhythms

Rather than immediately throwing a student into two-handed coordination, AIPC implements the 10-stage hierarchical progression:

1. **Stage 1: Hear & Orient:** Auditory model plays Reference layer, Counter-layer, and Composite. Student taps reference beat and signals cycle start (Phase 0).
2. **Stage 2: Predict & Locate:** Engine silences selected attacks or coincidence points; student speaks or taps the predicted arrival.
3. **Stage 3: Map:** Visual display provides a temporary common subdivision grid (LCM) or circular phase wheel highlighting coincidence points and largest gaps.
4. **Stage 4: Secure Layer A:** System plays quiet reference pulse; student performs Layer A with steady intervals across 4 consecutive cycles.
5. **Stage 5: Secure Layer B:** System plays quiet reference pulse; student performs Layer B with steady intervals across 4 consecutive cycles.
6. **Stage 6: Coordinate with Differentiated Sound/Limbs:** Student performs both layers simultaneously using distinct physical timbres (e.g. wooden rim click vs. deep drum, or left hand vs. right hand) at a slow, viable tempo.
7. **Stage 7: Attentional Switching & Accent Migration:** While maintaining the composite groove, student dynamically foregrounds/accents Layer A on cue, then switches to foregrounding Layer B without stopping.
8. **Stage 8: Systematic Fading:** Supports are removed one variable at a time:
   - *Fade 1:* Subdivision grid muted (coincidence click only).
   - *Fade 2:* Coincidence click reduced to cycle start.
   - *Fade 3:* Model layer muted; student continues through silent spans.
   - *Fade 4:* Visual phase wheel hidden.
9. **Stage 9: Musical Transfer:** Pitch, articulation, and expressive dynamics of the original repertoire excerpt are restored on the instrument.
10. **Stage 10: Retention & Self-Regulation (SRL):** Delayed probe tests reconstruction without full scaffold; student completes metacognitive reflection (attributing errors to specific phase points).

---

### 6.7 Adaptive Embedded Subdivision Resolution vs Global Metre Invariance

A critical pedagogical flaw in naive rhythmic trainers is assuming that micro-subdivisions strictly follow the global time signature (e.g. assuming 4/4 always implies duple eighth-note or sixteenth-note subdivisions).

#### 1. The Embedded Subdivisions Phenomenon
In classical, jazz, and contemporary repertoire, passages frequently feature **embedded subdivisions** that contradict or diverge from the prevailing metric denominator:
* **Embedded Triplets in Simple Metre:** In 4/4 or 2/4 time, individual beats may feature eighth-note triplets ($3 \times \frac{1}{3}\text{ beat} = 1\text{ beat}$) or quarter-note triplets ($3 \times \frac{2}{3}\text{ beat} = 2\text{ beats}$). Emitting straight sixteenth-note clicks ($4 \times \frac{1}{4}\text{ beat}$) during a triplet figure produces an acoustic 4:3 polyrhythmic collision that confuses the student and destroys the intended scaffolding.
* **Mixed-Subdivision Measures:** Beat 1 might contain a straight sixteenth-note run ($\sigma = 4$), while Beat 2 transitions immediately into an expressive eighth-note triplet ($\sigma = 3$). A fixed-grid metronome fails in these transitions.

#### 2. Beat-Level Subdivision Lattice $\sigma(b)$
The AIPC engine calculates the local subdivision density $\sigma(b)$ for each beat $b \in [1..N]$ by analyzing note durations and MusicXML `<time-modification>` tags:

$$\sigma(b) = \begin{cases} 
3 & \text{if beat } b \text{ contains active eighth triplets } (8t, \text{actual-notes}=3) \\ 
6 & \text{if beat } b \text{ contains sixteenth-note triplets } (16t) \\ 
4 & \text{if beat } b \text{ contains sixteenth notes without tuplets } (16, 16d) \\ 
2 & \text{default eighth-note duple lattice} 
\end{cases}$$

#### 3. Algorithmic Implementation in AIPC
1. **Automated Inspection (`analyzeEmbeddedSubdivisions`):** Inspects target measure notes and outputs both a `dominantRatio` (e.g. 3 for triplet-predominant passages) and a `beatSubdivisionMap` (mapping individual beat indices to their required subdivision ratio).
2. **Dynamic Metronome Scheduling (`PlaybackSession` & `ClickAudioGenerator`):** In `playbackSession.ts` and `clickAudioGenerator.ts`, micro-clicks are emitted at `timeInBeats + sub / ratio`. When beat $b$ has $\sigma(b) = 3$, micro-ticks sound at $+1/3$ and $+2/3$ beat offsets, perfectly reinforcing the triplet figures.
3. **Adaptive Strategy Scaffolds (`ExplicitSubdivisionStrategy` & `UnevenSubdivisionStrategy`):** The strategy scaffolding automatically switches from `'semiquaver_grid'` to `'triplet_grid'` when embedded triplets are detected, updating the learner prompt:
   > *"Audible triplet subdivision grid active (3 ticks per beat) matching embedded triplets! Keep notes locked to the micro-ticks."*
4. **Student Chatbot Explanations:** The chatbot companion explicitly notifies the student of embedded subdivisions, reducing cognitive load and explaining why the metronome sounds in 3s despite the 4/4 signature.


