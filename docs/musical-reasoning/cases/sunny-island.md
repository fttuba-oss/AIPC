# Sunny Island — texture reference case

- Composer: Kahchun Wong (2016), as displayed in the score.
- Source: stored MusicXML in `storage/scores/score_1792034229527_snur.json`, field `xml`, in this repository.
- Analysis recorded: 2026-11-02; initial reasoning revision.
- Scope: 116 written measures, full ensemble score; pitches compared at concert pitch. Ranges below use written measure numbers, not elapsed playback positions.
- Validation: teacher broadly endorsed the analysis as “quite accurate”; individual rows have not all received explicit confirmation. This is an interpreted reference, not authoritative composer annotation or machine-validated ground truth.

## Reference statements

- Opening melody: clarinets 1–3 and tenor saxophone, pickup in bar 2 on the and of beat 3, continuing through 6. Opening sounding pitches F3–Bb3–A3. Bar 1 establishes accompaniment.
- A theme: clarinets and alto saxophones, 13–20; fuller statement 21–28 and return at D.
- Dayung Sampan: euphonium at E (55), then trumpets at F (65), then harmonised brass at H (87), up a whole tone. Opening E pitches G3–Bb3–C4; F G4–Bb4–C5; H A4–C5–D5 in trumpet 1.

Bass group below means bassoon, bass clarinet, baritone saxophone, tuba and string bass where scored. Percussion generally supplies pulse, accents and transitions. Listed instruments do not necessarily play throughout every bar of a span.

## Section map

| Section / written bars | Melody | Countermelody / secondary layer | Accompaniment |
|---|---|---|---|
| Opening 1–6 | Clarinets 1–3 and tenor saxophone from pickup in 2 | Horn answering line from 4 | Bass group; repeated trombone/euphonium chords; 1 is introductory support |
| Pickup to 7–10 | Upper woodwinds and trumpets, with clarinet reinforcement/harmonisation | Horn and alto saxophone inner answering line | Lower reeds and low brass |
| Transition 11–12 | Connecting gestures and pickups | No sustained independent counterline | March pulse and harmonic support |
| A 13–20 | Clarinets and alto saxophones | No prominent independent counterline initially | Bass-group beat pattern, offbeat trombone chords |
| A 21–28 | Flutes, oboe and trumpets join the tune with clarinet/alto reinforcement; glockenspiel doubles | Tenor saxophone, horns and euphonium: broader independent line | Bass group and offbeat trombone chords |
| B 29–32 | Moving lower-band line: lower reeds, tenor saxophone, horns, trombones, euphonium and bass instruments in octave reinforcement | No strong separate sustained counterline | Upper woodwind/trumpet repeated harmonised fanfare figures |
| B 33–36 | Flutes, clarinets and alto saxophones; glockenspiel reinforcement | Slower tenor saxophone secondary line | Lower-reed bass; brass approach to C |
| C 37–40 | Return of B's lower-band line | No strong separate sustained counterline | Upper woodwind/trumpet fanfare chords |
| C 41–44 | Upper woodwinds and clarinets, reinforced by glockenspiel | Moving lower-reed support; low-brass closing response at 43–44, rather than a continuous countertheme | Inner harmony and bass |
| D 45–52 | A theme in piccolo, flutes, oboe, clarinets and trumpets | Alto saxophones and horns | Tenor saxophone, trombones and euphonium offbeats; bass group |
| Link 53–54 | Featured descending tubular-bell connector | No sustained counterline | Ensemble closing gestures and bass |
| E 55–64 | Euphonium: Dayung Sampan, through 63 | Piccolo/flute/oboe/clarinet 1/glockenspiel decorative replies; not a continuous countermelody | Horn offbeats, bass group; upper-wind closing link |
| F 65–74 | Trumpets 1–3: Dayung Sampan, through 73 | Bassoon, tenor saxophone and euphonium | Horn offbeats; bass clarinet/baritone saxophone/tuba/string bass; upper-wind link at 74 |
| G 75–78 | Flutes, clarinets 1–2 and oboe in harmonised upper texture; glockenspiel | Clarinet 3, alto saxophones and horns: slower inner line, provisional counterline classification | Syncopated bass, trombone punctuation, later trumpet responses |
| G 79–86 | Flutes initially, then exchanges of wind runs and brass gestures | Horn inner line early; short responses later | Sustained clarinet harmony, bass patterns and brass/percussion punctuation |
| H 87–96 | Trumpets, trombones and euphonium: harmonised Dayung Sampan in higher key | Upper woodwinds and clarinets, with glockenspiel; sustained tones plus moving decorations | Saxophone/horn offbeats and bass group |
| I 97–112 | Broad line in trumpets, tenor saxophone, trombones and euphonium | Upper woodwinds, clarinets and alto saxophones from 99; increasingly active at 109–112; selected glockenspiel doubling | Rhythmic horns, bass group and timpani |
| J 113–116 | Upper woodwind/clarinet/alto closing figure; tubular bells reinforce outline at 113–114 | No separate sustained counterline | Brass held chord/final punctuation, bass and percussion |

## Evidence and reusable lessons

- **A 21:** the independent tenor/horn/euphonium line is not another instrument doubling the upper melody. Compare its broad rhythm and contour against the continuing A tune.
- **B/C opening:** lower line begins concert G–Bb–D–Eb–D, while upper parts repeat harmonised rhythmic attacks. This supports lower-band foreground despite the brightness of the upper texture.
- **E/F/H:** matching thematic identity across changing orchestration is stronger evidence than assigning roles by instrument. The Dayung Sampan opening survives octave transfer and transposition.
- **E:** upper arpeggiated replies are decorative activity, not automatically a separate continuous theme.
- **H/I:** fast upper notes do not alone displace the broad brass melody.
- **J:** many instruments share a closing gesture; multiplying labels by staff would overcount melodic layers.

## Uncertainty and review priorities

- G's slower inner line could be classified as countermelody or melodic accompaniment. Keep both readings pending focused teacher review.
- Opening answers and B/C slower supporting lines need phrase-level judgement; secondary activity does not always warrant a countermelody label.
- Section ranges summarise handoffs. A future machine-readable annotation should mark exact beats, pickups, rests and individual voices, especially in combined flute/horn parts.
- Recheck this case when a new rule changes doubling detection, thematic priority or treatment of decorative lines. Do not silently promote this table to fully verified training labels.
