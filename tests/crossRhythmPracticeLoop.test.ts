import test from 'node:test';
import assert from 'node:assert/strict';
import { CrossRhythmPracticeLoopController } from '../src/strategies/classifications/rhythm/controllers/CrossRhythmPracticeLoopController.js';

test('CrossRhythmPracticeLoopController: Complete Pedagogical Loop (Rules G1–G8)', async (t) => {

  await t.test('1. Initial state starts at target BPM in AUDITORY_PRIMING', () => {
    const loop = new CrossRhythmPracticeLoopController(112, 'student_01');
    const state = loop.getState();
    assert.equal(state.stage, 'AUDITORY_PRIMING');
    assert.equal(state.targetBpm, 112);
    assert.equal(state.currentBpm, 112);
  });

  await t.test('2. Rule G2: onDemoCompleted transitions to INITIAL_CHOICE with options to listen or try', () => {
    const loop = new CrossRhythmPracticeLoopController(112);
    const res = loop.onDemoCompleted();
    assert.equal(res.nextStage, 'INITIAL_CHOICE');
    const keys = res.actionOptions.map(o => o.key);
    assert.ok(keys.includes('ready_to_play'));
    assert.ok(keys.includes('listen_demo'));
    assert.ok(keys.includes('drop_10_initial'));
  });

  await t.test('3. Rule G4: Tier 1 failure suggests -10 BPM drop', () => {
    const loop = new CrossRhythmPracticeLoopController(112);
    loop.onDemoCompleted();
    const res = loop.registerAttempt(false, 0.55);
    assert.equal(res.nextStage, 'DESCENDING');
    assert.equal(res.recommendedBpm, 102); // 112 - 10
    const keys = res.actionOptions.map(o => o.key);
    assert.ok(keys.includes('apply_bpm_drop_10'));
  });

  await t.test('4. Rule G3: applyTempoChange updates BPM and prompts audio recalibration', () => {
    const loop = new CrossRhythmPracticeLoopController(112);
    const res = loop.applyTempoChange(102);
    assert.equal(res.recommendedBpm, 102);
    assert.equal(res.audioRecalibrationRequired, true);
    assert.ok(res.tootsMessage.includes('102 BPM'));
  });

  await t.test('5. Rule G4 & G5: Tier 2 failure offers -10 and -20 BPM options', () => {
    const loop = new CrossRhythmPracticeLoopController(112);
    loop.registerAttempt(false, 0.50); // Tier 1
    loop.applyTempoChange(102);
    const res = loop.registerAttempt(false, 0.52); // Tier 2
    assert.equal(res.nextStage, 'DESCENDING');
    const keys = res.actionOptions.map(o => o.key);
    assert.ok(keys.includes('apply_bpm_drop_10'));
    assert.ok(keys.includes('apply_bpm_drop_20'));
  });

  await t.test('6. Rule G7: Clean pass during descent establishes stable floor and enters ASCENDING phase', () => {
    const loop = new CrossRhythmPracticeLoopController(112);
    loop.registerAttempt(false, 0.50); // 112 fail
    loop.applyTempoChange(90);
    const passRes = loop.registerAttempt(true, 0.92); // 90 pass!
    
    assert.equal(passRes.nextStage, 'ASCENDING');
    const state = loop.getState();
    assert.equal(state.stableFloorBpm, 90);
    assert.equal(state.currentBpm, 98); // 90 + 8
    assert.equal(passRes.audioRecalibrationRequired, true);
    assert.ok(passRes.tootsMessage.includes('ladder the tempo back up'));
  });

  await t.test('7. Rule G8: Stumble during ascent provides 2-strike cushion without resetting baseline', () => {
    const loop = new CrossRhythmPracticeLoopController(112);
    loop.applyTempoChange(90);
    loop.registerAttempt(true, 0.95); // Floor at 90, steps to 98
    
    // First mistake at 98 BPM
    const fail1 = loop.registerAttempt(false, 0.60);
    assert.equal(fail1.nextStage, 'PLATEAU_BUFFER');
    assert.ok(fail1.tootsMessage.includes("doesn't mean you lost the skill"));
    assert.equal(loop.getState().currentBpm, 98); // Does not regress!

    // Second mistake at 98 BPM
    const fail2 = loop.registerAttempt(false, 0.62);
    assert.equal(fail2.nextStage, 'PLATEAU_BUFFER');
    assert.equal(loop.getState().currentBpm, 98);

    // Third consecutive mistake at 98 BPM triggers PLATEAU_CHOICE
    const fail3 = loop.registerAttempt(false, 0.58);
    assert.equal(fail3.nextStage, 'PLATEAU_CHOICE');
    const keys = fail3.actionOptions.map(o => o.key);
    assert.ok(keys.includes('take_break')); // 30s brain break option
    assert.ok(keys.includes('consolidate_rung')); // step back 8 BPM
  });

  await t.test('8. Reaching target tempo triggers MASTERED stage', () => {
    const loop = new CrossRhythmPracticeLoopController(100);
    loop.applyTempoChange(96);
    loop.registerAttempt(true, 0.92); // Steps to 100
    const finalRes = loop.registerAttempt(true, 0.96); // 100 pass!
    assert.equal(finalRes.nextStage, 'MASTERED');
    assert.ok(finalRes.tootsMessage.includes('Mastered'));
  });

  await t.test('9. Rule G6: Tier 3 failure / floor triggers Teacher Handoff and exit', () => {
    const loop = new CrossRhythmPracticeLoopController(112);
    loop.registerAttempt(false, 0.50); // fail 1
    loop.registerAttempt(false, 0.48); // fail 2
    loop.applyTempoChange(50); // Drop to bottom floor
    const res = loop.registerAttempt(false, 0.45); // fail 3 at floor
    assert.equal(res.nextStage, 'REFERRED');
    assert.ok(res.handoffRecord);
    assert.equal(res.handoffRecord.problemSignatureId, 'PS_CROSS_RHYTHM_01');
    assert.ok(res.tootsMessage.includes('saved your practice data for your teacher'));
  });

});
