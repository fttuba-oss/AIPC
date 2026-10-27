/**
 * CrossRhythmPracticeLoopController: Deterministic State Machine for Cross-Rhythm Mastery
 * 
 * Implements the 8 Pedagogical Guide Rules:
 * - Rule G1: Acoustic & Motor Decoupling (Tap mode only, no instrument)
 * - Rule G2: Auditory Template Priming with Learner Choice (Listen vs. Try)
 * - Rule G3: Auditory Model Recalibration upon Tempo Shift
 * - Rule G4: Graduated 3-Tier Tempo De-Escalation Ladder (-10, -20, floor)
 * - Rule G5: Scaffold Agency (Autonomy in step-size choices)
 * - Rule G6: Anti-Frustration Ceiling & Bounded Teacher Referral
 * - Rule G7: Systematic Ascending Ladder Reconstruction (+8 BPM to target)
 * - Rule G8: Non-Catastrophic Error Resilience (2-Strike Buffer & 30s Break)
 */

import type { TeacherHandoffRecord } from '../types/diagnosticProfile';

export type PracticeLoopStage =
  | 'AUDITORY_PRIMING'   // Listening to initial reference demo
  | 'INITIAL_CHOICE'      // Choose: Try it now OR Listen again
  | 'DESCENDING'          // Finding stable tempo floor via 3 tiers
  | 'FLOOR_CONFIRMED'     // Stable floor reached, transitioning to ascent
  | 'ASCENDING'           // Laddering back up (+8 BPM) toward target tempo
  | 'PLATEAU_BUFFER'      // Stumble near speed frontier; 2-strike buffer active
  | 'PLATEAU_CHOICE'      // Persistent error after 2 retries; offer break or consolidate
  | 'REST_BREAK'          // Active 30s cognitive dissipation break
  | 'MASTERED'            // Target tempo achieved with solid timing
  | 'REFERRED';           // Bounded exit to teacher handoff

export interface CrossRhythmLoopState {
  stage: PracticeLoopStage;
  targetBpm: number;
  currentBpm: number;
  stableFloorBpm: number | null;
  descentTier: 1 | 2 | 3;
  descentMistakeCount: number;
  ascentRetryCount: number; // 0, 1, 2
  plateauBpm: number | null;
  totalAttempts: number;
  consecutivePassesAtCurrentBpm: number;
  lastAttemptPassed: boolean | null;
  teacherHandoffRecord: TeacherHandoffRecord | null;
}

export interface LoopEvaluationResult {
  nextStage: PracticeLoopStage;
  recommendedBpm: number;
  tootsMessage: string;
  actionOptions: Array<{
    key: string;
    label: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'success' | 'amber';
  }>;
  audioRecalibrationRequired: boolean;
  handoffRecord?: TeacherHandoffRecord;
}

export class CrossRhythmPracticeLoopController {
  private state: CrossRhythmLoopState;
  private studentId: string;
  private passageId: string;

  constructor(targetBpm: number = 112, studentId: string = 'student_01', passageId: string = 'Bb_Tpt_3_M6_B1') {
    this.studentId = studentId;
    this.passageId = passageId;
    this.state = {
      stage: 'AUDITORY_PRIMING',
      targetBpm,
      currentBpm: targetBpm,
      stableFloorBpm: null,
      descentTier: 1,
      descentMistakeCount: 0,
      ascentRetryCount: 0,
      plateauBpm: null,
      totalAttempts: 0,
      consecutivePassesAtCurrentBpm: 0,
      lastAttemptPassed: null,
      teacherHandoffRecord: null,
    };
  }

  public getState(): Readonly<CrossRhythmLoopState> {
    return { ...this.state };
  }

  /**
   * Called when reference demo finishes playing (Rule G2)
   */
  public onDemoCompleted(): LoopEvaluationResult {
    this.state.stage = 'INITIAL_CHOICE';
    return {
      nextStage: 'INITIAL_CHOICE',
      recommendedBpm: this.state.currentBpm,
      tootsMessage: `🎧 Reference demo complete at ${this.state.currentBpm} BPM! Watch how attack slots [1, 4, 5] subdivide each beat. What would you like to do?`,
      actionOptions: [
        { key: 'ready_to_play', label: "I'm Ready to Try!", icon: '🎺', variant: 'primary' },
        { key: 'listen_demo', label: 'Listen One More Time', icon: '🔁', variant: 'secondary' },
        { key: 'drop_10_initial', label: 'Start a Bit Slower (-10 BPM)', icon: '🐢', variant: 'secondary' },
      ],
      audioRecalibrationRequired: false,
    };
  }

  /**
   * Processes an attempt result (accuracy >= 0.70 passes)
   */
  public registerAttempt(passed: boolean, accuracy: number): LoopEvaluationResult {
    this.state.totalAttempts++;
    this.state.lastAttemptPassed = passed;

    if (passed) {
      this.state.consecutivePassesAtCurrentBpm++;
      return this.handlePassedAttempt();
    } else {
      this.state.consecutivePassesAtCurrentBpm = 0;
      return this.handleFailedAttempt(accuracy);
    }
  }

  /**
   * Evaluates successful attempt: Floor discovery or Ascent progression (Rule G7)
   */
  private handlePassedAttempt(): LoopEvaluationResult {
    // Case 1: Mastered at target tempo!
    if (this.state.currentBpm >= this.state.targetBpm) {
      this.state.stage = 'MASTERED';
      return {
        nextStage: 'MASTERED',
        recommendedBpm: this.state.targetBpm,
        tootsMessage: `🌟 Mastered! You performed the Beat 1 cross-rhythm cleanly at full target tempo (${this.state.targetBpm} BPM)! Rock-solid internal timing.`,
        actionOptions: [
          { key: 'return_to_portal', label: 'Complete & Return to Piece', icon: '🏆', variant: 'primary' },
          { key: 'ready_to_play', label: 'Do One More Victory Lap', icon: '🔁', variant: 'secondary' },
        ],
        audioRecalibrationRequired: false,
      };
    }

    // Case 2: Found stability during descent (Floor Confirmed)
    if (this.state.stage === 'DESCENDING' || this.state.stage === 'INITIAL_CHOICE' || this.state.stage === 'AUDITORY_PRIMING') {
      this.state.stableFloorBpm = this.state.currentBpm;
      this.state.stage = 'ASCENDING';
      this.state.ascentRetryCount = 0;
      const nextBpm = Math.min(this.state.targetBpm, this.state.currentBpm + 8);
      this.state.currentBpm = nextBpm;

      return {
        nextStage: 'ASCENDING',
        recommendedBpm: nextBpm,
        tootsMessage: `🎯 Rock-solid baseline found at ${this.state.stableFloorBpm} BPM! Now let's ladder the tempo back up step-by-step toward our target (${this.state.targetBpm} BPM). Stepping up to ${nextBpm} BPM!`,
        actionOptions: [
          { key: 'listen_demo', label: `🎧 Listen at ${nextBpm} BPM`, icon: '🎧', variant: 'primary' },
          { key: 'ready_to_play', label: `Start at ${nextBpm} BPM`, icon: '▶️', variant: 'secondary' },
        ],
        audioRecalibrationRequired: true,
      };
    }

    // Case 3: Progressing up the ascending ladder
    this.state.ascentRetryCount = 0;
    const nextBpm = Math.min(this.state.targetBpm, this.state.currentBpm + 8);
    const isTarget = nextBpm >= this.state.targetBpm;
    this.state.currentBpm = nextBpm;

    return {
      nextStage: 'ASCENDING',
      recommendedBpm: nextBpm,
      tootsMessage: isTarget
        ? `🔥 Fantastic! Stepping up to full TARGET TEMPO (${nextBpm} BPM)! Lock in your attack slots [1, 4, 5] and nail it!`
        : `⚡ Clean execution! Stepping up to ${nextBpm} BPM (${this.state.targetBpm - nextBpm} BPM from target). Keep that steady groove!`,
      actionOptions: [
        { key: 'ready_to_play', label: `Play at ${nextBpm} BPM`, icon: '▶️', variant: 'primary' },
        { key: 'listen_demo', label: `🎧 Listen at ${nextBpm} BPM`, icon: '🎧', variant: 'secondary' },
      ],
      audioRecalibrationRequired: true,
    };
  }

  /**
   * Evaluates failed attempt: 3-tier descent or 2-strike ascent plateau (Rules G4 & G8)
   */
  private handleFailedAttempt(accuracy: number): LoopEvaluationResult {
    // If in ASCENDING phase: Rule G8 (2-strike retry buffer, do NOT panic-regress!)
    if (this.state.stage === 'ASCENDING' || this.state.stage === 'PLATEAU_BUFFER') {
      this.state.ascentRetryCount++;
      if (this.state.ascentRetryCount < 3) {
        this.state.stage = 'PLATEAU_BUFFER';
        const remaining = 3 - this.state.ascentRetryCount;
        return {
          nextStage: 'PLATEAU_BUFFER',
          recommendedBpm: this.state.currentBpm,
          tootsMessage: `💪 Don't worry! Stumbling near top speed doesn't mean you lost the skill—your motor coordination is just testing the speed frontier! Let's take ${remaining} more ${remaining === 1 ? 'try' : 'tries'} right at ${this.state.currentBpm} BPM.`,
          actionOptions: [
            { key: 'ready_to_play', label: `Try Again at ${this.state.currentBpm} BPM`, icon: '🔄', variant: 'primary' },
            { key: 'listen_demo', label: '🎧 Listen to Groove First', icon: '🎧', variant: 'secondary' },
            { key: 'consolidate_rung', label: `Step Back to ${Math.max(50, this.state.currentBpm - 8)} BPM`, icon: '🐢', variant: 'secondary' },
          ],
          audioRecalibrationRequired: false,
        };
      } else {
        // Plateau reached after 2 retries failed at same tempo
        this.state.stage = 'PLATEAU_CHOICE';
        this.state.plateauBpm = this.state.currentBpm;
        const consolidatedBpm = Math.max(50, this.state.currentBpm - 8);

        return {
          nextStage: 'PLATEAU_CHOICE',
          recommendedBpm: consolidatedBpm,
          tootsMessage: `🧠 Speed boundary reached at ${this.state.currentBpm} BPM. Intense cross-rhythms build neural fatigue. Would you like to consolidate at a comfortable ${consolidatedBpm} BPM, or take a quick 30-second brain break?`,
          actionOptions: [
            { key: 'take_break', label: '☕ Take a 30s Brain Break', icon: '☕', variant: 'amber' },
            { key: 'consolidate_rung', label: `Consolidate at ${consolidatedBpm} BPM`, icon: '🐢', variant: 'primary' },
            { key: 'handoff_exit', label: 'Save for Teacher & Continue', icon: '📋', variant: 'secondary' },
          ],
          audioRecalibrationRequired: false,
        };
      }
    }

    // Otherwise: In DESCENDING phase (Rules G4 & G6)
    this.state.descentMistakeCount++;
    this.state.stage = 'DESCENDING';

    // Tier 1: First mistake -> Suggest -10 BPM (Rule G4)
    if (this.state.descentTier === 1 && this.state.descentMistakeCount === 1) {
      const suggestedBpm = Math.max(50, this.state.currentBpm - 10);
      return {
        nextStage: 'DESCENDING',
        recommendedBpm: suggestedBpm,
        tootsMessage: `A small timing wobble on the tuplet (${Math.round(accuracy * 100)}% accuracy). Let's bring the tempo down by -10 BPM to ${suggestedBpm} BPM to feel each attack slot clearly!`,
        actionOptions: [
          { key: 'apply_bpm_drop_10', label: `Drop to ${suggestedBpm} BPM (-10)`, icon: '🐢', variant: 'primary' },
          { key: 'listen_demo', label: '🎧 Listen to Demo First', icon: '🎧', variant: 'secondary' },
          { key: 'retry_current_bpm', label: `Try Again at ${this.state.currentBpm} BPM`, icon: '🔄', variant: 'secondary' },
        ],
        audioRecalibrationRequired: false,
      };
    }

    // Tier 2: Mistake again at lower tempo -> Offer -10 or -20 BPM drop (Rule G4 & G5)
    if (this.state.descentMistakeCount === 2) {
      this.state.descentTier = 2;
      const drop10 = Math.max(50, this.state.currentBpm - 10);
      const drop20 = Math.max(50, this.state.currentBpm - 20);
      return {
        nextStage: 'DESCENDING',
        recommendedBpm: drop10,
        tootsMessage: `Still a bit rushed on attack slot 4/5. Let's expand our timing window! How much would you like to slow it down?`,
        actionOptions: [
          { key: 'apply_bpm_drop_10', label: `Drop -10 BPM (to ${drop10} BPM)`, icon: '🐢', variant: 'secondary' },
          { key: 'apply_bpm_drop_20', label: `Drop -20 BPM (to ${drop20} BPM)`, icon: '⚡', variant: 'primary' },
          { key: 'listen_demo', label: `🎧 Listen at ${this.state.currentBpm} BPM`, icon: '🎧', variant: 'secondary' },
        ],
        audioRecalibrationRequired: false,
      };
    }

    // Tier 3: Third mistake -> Final drop or Teacher Handoff (Rule G6)
    if (this.state.descentMistakeCount >= 3) {
      this.state.descentTier = 3;
      const finalFloorBpm = Math.max(48, this.state.currentBpm - 10);

      // Check if already at bottom floor (< 55 BPM)
      if (this.state.currentBpm <= 56) {
        return this.triggerTeacherReferral('Tempo floor reached (< 55 BPM) with persistent cross-rhythm coordination difficulty.');
      }

      return {
        nextStage: 'DESCENDING',
        recommendedBpm: finalFloorBpm,
        tootsMessage: `We're at our tempo floor check! Would you like one last drop to ${finalFloorBpm} BPM, or shall we save this insight for your teacher and move forward in your agenda?`,
        actionOptions: [
          { key: 'apply_bpm_floor', label: `Try Floor at ${finalFloorBpm} BPM`, icon: '🎯', variant: 'secondary' },
          { key: 'handoff_exit', label: 'Save for Teacher & Move Forward', icon: '📋', variant: 'primary' },
        ],
        audioRecalibrationRequired: false,
      };
    }

    return {
      nextStage: 'DESCENDING',
      recommendedBpm: Math.max(50, this.state.currentBpm - 10),
      tootsMessage: `Let's keep steady! Try again or adjust your tempo.`,
      actionOptions: [
        { key: 'ready_to_play', label: 'Try Again', icon: '▶️', variant: 'primary' },
      ],
      audioRecalibrationRequired: false,
    };
  }

  /**
   * Applies an explicit tempo shift (Rule G3: Prompts to re-listen)
   */
  public applyTempoChange(newBpm: number): LoopEvaluationResult {
    const oldBpm = this.state.currentBpm;
    this.state.currentBpm = Math.max(45, Math.min(180, newBpm));
    const delta = this.state.currentBpm - oldBpm;

    return {
      nextStage: this.state.stage,
      recommendedBpm: this.state.currentBpm,
      tootsMessage: `Tempo calibrated to ${this.state.currentBpm} BPM (${delta > 0 ? `+${delta}` : delta} BPM). Every time tempo changes, listen to the reference demo first to recalibrate your ear!`,
      actionOptions: [
        { key: 'listen_demo', label: `🎧 Listen at ${this.state.currentBpm} BPM`, icon: '🎧', variant: 'primary' },
        { key: 'ready_to_play', label: `Play at ${this.state.currentBpm} BPM`, icon: '▶️', variant: 'secondary' },
      ],
      audioRecalibrationRequired: true,
    };
  }

  /**
   * Consolidate down 1 rung after plateau
   */
  public consolidateRung(): LoopEvaluationResult {
    const target = Math.max(50, this.state.currentBpm - 8);
    this.state.ascentRetryCount = 0;
    this.state.stage = 'ASCENDING';
    return this.applyTempoChange(target);
  }

  /**
   * Generates graceful Teacher Handoff record and exits (Rule G6)
   */
  public triggerTeacherReferral(reasonDetail?: string): LoopEvaluationResult {
    this.state.stage = 'REFERRED';
    const handoff: TeacherHandoffRecord = {
      studentId: this.studentId,
      passageId: this.passageId,
      problemSignatureId: 'PS_CROSS_RHYTHM_01',
      problemName: '3:2 Cross-Rhythm Coordination',
      baselineSummary: `Student completed ${this.state.totalAttempts} attempts. Tempo floor reached without satisfying cross-rhythm timing gate.`,
      interventionsAttempted: [
        {
          interventionId: 'DI_LCM_GRID_01',
          interventionName: 'LCM Matrix Grid (3:2 Tuplet Tap)',
          attempts: this.state.totalAttempts,
          response: 'no_meaningful_change',
        },
      ],
      persistentLocations: [
        { measureNumber: 6, beatPosition: 1, noteIndex: 1 },
      ],
      leadingHypotheses: [],
      reasonForReferral: reasonDetail || 'Tempo floor reached with persistent cross-rhythm timing errors. Decoupled and bounded per Rule G6.',
      suggestedTeacherCheck: [
        'Check physical hand/finger tension or posture during the 3:2 cross-rhythm passage.',
        'Have student speak/chant rhythm syllables away from the instrument.',
        'Observe somatic vocalization and physical hand coordination.',
      ],
      supportingAttemptIds: [],
      createdAt: new Date().toISOString(),
    };

    this.state.teacherHandoffRecord = handoff;

    return {
      nextStage: 'REFERRED',
      recommendedBpm: this.state.currentBpm,
      tootsMessage: `🌱 Great effort today! You gave this cross-rhythm solid work. AIPC has saved your practice data for your teacher to review. Let's head back to the score and move on to your next section!`,
      actionOptions: [
        { key: 'confirm_handoff_exit', label: 'View Teacher Report & Return to Portal', icon: '🚪', variant: 'primary' },
      ],
      audioRecalibrationRequired: false,
      handoffRecord: handoff,
    };
  }
}
