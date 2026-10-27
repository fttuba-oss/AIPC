import test from 'node:test';
import assert from 'node:assert/strict';

import { KnowledgeSimulatorService } from '../../src/legacy/backend/service/KnowledgeSimulatorService.ts';
import { DomainRegistry } from '../../src/legacy/backend/registry/DomainRegistry.ts';
import { LayerRegistry } from '../../src/legacy/backend/registry/LayerRegistry.ts';
import { KnowledgeValidator } from '../../src/legacy/backend/validation/KnowledgeValidator.ts';

test('AIPC Pedagogical Knowledgebase & Simulator Test Suite', async (t) => {

  await t.test('1. listDomains returns all 7 domains: rhythm (implemented) + 6 placeholders', () => {
    const domains = KnowledgeSimulatorService.listDomains();
    assert.equal(domains.length, 7, 'Must have exactly 7 domains');

    const rhythm = domains.find(d => d.id === 'rhythm');
    assert.ok(rhythm, 'Rhythm domain must exist');
    assert.equal(rhythm.status, 'implemented');

    const expectedPlaceholders = [
      'tone',
      'pitch_intonation',
      'articulation',
      'technique_coordination',
      'breathing_air_support',
      'expression_style',
    ];

    for (const phId of expectedPlaceholders) {
      const ph = domains.find(d => d.id === phId);
      assert.ok(ph, `Placeholder domain ${phId} must exist`);
      assert.equal(ph.status, 'placeholder', `${phId} must have status placeholder`);
    }
  });

  await t.test('2. Placeholder domains have valid schemas but empty collections', () => {
    const domains = KnowledgeSimulatorService.listDomains();
    const placeholders = domains.filter(d => d.status === 'placeholder');
    assert.equal(placeholders.length, 6);

    for (const ph of placeholders) {
      assert.equal(ph.capacityIds.length, 0, `${ph.id} must have 0 capacities`);
      assert.equal(ph.problemSignatureIds.length, 0, `${ph.id} must have 0 problem signatures`);
      assert.equal(ph.diagnosticInterventionIds.length, 0, `${ph.id} must have 0 diagnostic interventions`);
      assert.equal(ph.strategyIds.length, 0, `${ph.id} must have 0 strategies`);
      assert.equal(ph.responseRuleIds.length, 0, `${ph.id} must have 0 response rules`);
      assert.equal(ph.referralRuleIds.length, 0, `${ph.id} must have 0 referral rules`);
    }
  });

  await t.test('3. listLayers returns the 3 pedagogical layers in exact order (Diagnosis, Strategy, Guide)', () => {
    const layers = KnowledgeSimulatorService.listLayers();
    assert.equal(layers.length, 3, 'Must have exactly 3 layers');
    assert.deepEqual(
      layers.map(l => l.id),
      ['diagnosis', 'strategy', 'guide'],
      'Layers must be in exact 3-layer order (diagnosis, strategy, guide)'
    );
    assert.deepEqual(
      layers.map(l => l.sequence),
      [1, 2, 3]
    );
    assert.equal(layers[0].name, 'Diagnosis');
    assert.equal(layers[1].name, 'Strategy');
    assert.equal(layers[2].name, 'Guide');
  });

  await t.test('4. startSimulation(rhythm, PS-RUSH-01) returns trace covering Observe, Diagnose, and Intervene', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
      scenarioId: 'test_scenario_rushing',
    });

    assert.ok(sim.id);
    assert.equal(sim.domainId, 'rhythm');
    assert.equal(sim.problemSignatureId, 'PS-RUSH-01');
    assert.equal(sim.status, 'active');
    assert.equal(sim.nodes.length, 3, 'Must initialize with 3 nodes (Observe, Diagnose, Intervene)');

    assert.equal(sim.nodes[0].layer, 'observe');
    assert.equal(sim.nodes[1].layer, 'diagnose');
    assert.equal(sim.nodes[2].layer, 'intervene');
  });

  await t.test('5. Diagnose node: multiple hypotheses (RC03, RC08, etc.) present; no single root cause forced', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    const diagnoseNode = sim.nodes.find(n => n.layer === 'diagnose');
    assert.ok(diagnoseNode, 'Diagnose node must exist');
    assert.equal(diagnoseNode.status, 'provisional');

    const profile = sim.diagnosticProfile;
    assert.ok(profile.hypotheses.length >= 4, 'Must have at least 4 provisional hypotheses');
    
    const rc03 = profile.hypotheses.find(h => h.capacityId === 'RC03');
    const rc08 = profile.hypotheses.find(h => h.capacityId === 'RC08');
    assert.ok(rc03, 'RC03 (Internal pulse) must be in profile');
    assert.ok(rc08, 'RC08 (Instrumental execution) must be in profile');

    // Invariant: no single hypothesis forced to 100% certainty at the start
    for (const h of profile.hypotheses) {
      assert.notEqual(h.confidence, 'high', 'Initial hypotheses must remain provisional without premature high confidence');
    }
  });

  await t.test('6. Intervene node: Option A & B offered as probes with initial attempt bounds <= 3', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    const interveneNode = sim.nodes.find(n => n.layer === 'intervene');
    assert.ok(interveneNode);

    const refIds = interveneNode.knowledgeReferences.map(r => r.recordId);
    assert.ok(refIds.includes('DI-REF-SHADOW-01'), 'Option A must be offered');
    assert.ok(refIds.includes('DI-SLOW-CLICK-01'), 'Option B must be offered');

    // Apply Option A
    const updated = KnowledgeSimulatorService.applyIntervention(sim.id, {
      interventionId: 'DI-REF-SHADOW-01',
      learnerChoice: 'Option A',
    });

    assert.equal(updated.activeInterventionId, 'DI-REF-SHADOW-01');
    const appliedNode = updated.nodes[updated.nodes.length - 1];
    const maxAttempts = appliedNode.technicalDetails?.maxAttempts as number;
    assert.ok(maxAttempts <= 3, 'Initial attempts must be bounded to max 3');
    assert.ok(maxAttempts >= 1, 'Initial attempts must be at least 1');
  });

  await t.test('7. Response A: strengthens RC05/RC08, recommends Persist, mandates retest', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    KnowledgeSimulatorService.applyIntervention(sim.id, { interventionId: 'DI-REF-SHADOW-01' });

    const adapted = KnowledgeSimulatorService.recordResponse(sim.id, {
      responsePattern: 'response_a_shadow_improved',
      attemptCount: 2,
    });

    assert.equal(adapted.finalDecision?.decision, 'Persist');
    assert.equal(adapted.finalDecision?.retestRequired, true, 'Mandates unassisted retest');
    
    // Check hypotheses updated
    const rc05 = adapted.diagnosticProfile.hypotheses.find(h => h.capacityId === 'RC05');
    assert.equal(rc05?.status, 'leading');
  });

  await t.test('8. Response B: rushing disappears at slower tempo, recommends Persist with tempo ladder', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    KnowledgeSimulatorService.applyIntervention(sim.id, { interventionId: 'DI-SLOW-CLICK-01' });

    const adapted = KnowledgeSimulatorService.recordResponse(sim.id, {
      responsePattern: 'response_b_slow_tempo_improved',
      attemptCount: 1,
    });

    assert.equal(adapted.finalDecision?.decision, 'Persist');
    assert.ok(adapted.finalDecision?.fadingSteps?.some(s => s.includes('BPM')), 'Includes tempo ladder');
  });

  await t.test('9. Response C: slower tempo cleared rushing, complex rhythm fails -> pivots to targeted rhythm', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    KnowledgeSimulatorService.applyIntervention(sim.id, { interventionId: 'DI-SLOW-CLICK-01' });

    const adapted = KnowledgeSimulatorService.recordResponse(sim.id, {
      responsePattern: 'response_c_complex_rhythm_remains',
      attemptCount: 2,
    });

    assert.equal(adapted.finalDecision?.decision, 'Pivot');
    assert.equal(adapted.finalDecision?.recommendedStrategyId, 'DI-XRAY-RHYTHM-01');

    const rc04 = adapted.diagnosticProfile.hypotheses.find(h => h.capacityId === 'RC04');
    assert.equal(rc04?.status, 'leading');
  });

  await t.test('10. Response D: persistent local 1-2 notes -> bounded to 3 attempts, generates TeacherHandoffRecord', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    KnowledgeSimulatorService.applyIntervention(sim.id, { interventionId: 'DI-REF-SHADOW-01' });

    // Attempt count = 3 triggers referral limit
    const adapted = KnowledgeSimulatorService.recordResponse(sim.id, {
      responsePattern: 'response_d_persistent_local_notes',
      attemptCount: 3,
    });

    assert.equal(adapted.finalDecision?.decision, 'Refer');
    assert.equal(adapted.status, 'referred');
    assert.ok(adapted.teacherHandoffRecord, 'TeacherHandoffRecord must be generated');
    assert.equal(adapted.teacherHandoffRecord?.problemSignatureId, 'PS-RUSH-01');
    assert.ok(adapted.teacherHandoffRecord?.reasonForReferral.includes('3-attempt limit'));
    assert.ok(adapted.teacherHandoffRecord?.suggestedTeacherCheck.length > 0);
  });

  await t.test('11. Response E: stable with click, drops out when click stops -> pivots to Gap Click', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    KnowledgeSimulatorService.applyIntervention(sim.id, { interventionId: 'DI-SLOW-CLICK-01' });

    const adapted = KnowledgeSimulatorService.recordResponse(sim.id, {
      responsePattern: 'response_e_sparse_click_unstable',
      attemptCount: 1,
    });

    assert.equal(adapted.finalDecision?.decision, 'Pivot');
    assert.equal(adapted.finalDecision?.recommendedStrategyId, 'DI-GAP-CLICK-01');
    
    const rc03 = adapted.diagnosticProfile.hypotheses.find(h => h.capacityId === 'RC03');
    assert.equal(rc03?.status, 'leading');
    assert.equal(rc03?.confidence, 'high');
  });

  await t.test('12. Invariant Validator passes with 0 errors across active records', () => {
    const validation = KnowledgeSimulatorService.validateKnowledgebase();
    assert.equal(validation.valid, true, 'Validation must pass');
    assert.equal(validation.errors.length, 0, 'Must have 0 validation errors');
  });

  await t.test('13. Notes authoring and 1-click Coding Agent Instructions generation', () => {
    const sim = KnowledgeSimulatorService.startSimulation({
      domainId: 'rhythm',
      problemSignatureId: 'PS-RUSH-01',
    });

    // Record note
    const note = KnowledgeSimulatorService.saveNote(
      sim.nodes[0].id,
      'Lead Pedagogical Designer',
      'Verify that drift slope calculation excludes rest bars.',
      ['drift', 'calibration']
    );

    assert.ok(note.id);
    assert.equal(note.author, 'Lead Pedagogical Designer');

    // Fetch notes
    const storedNotes = KnowledgeSimulatorService.getNotes(sim.nodes[0].id);
    assert.ok(storedNotes.some(n => n.id === note.id));

    // Generate instructions for coding agent
    const instructions = KnowledgeSimulatorService.generateCodingInstructions(sim.id);
    assert.ok(instructions.title.includes('PS-RUSH-01'));
    assert.ok(instructions.instructionsMarkdown.includes('# AIPC Pedagogical Refinement Instruction'));
    assert.ok(instructions.instructionsMarkdown.includes('Verify that drift slope calculation excludes rest bars'));
    assert.ok(instructions.instructionsMarkdown.includes('Instructions for Coding Agent'));
  });

});
