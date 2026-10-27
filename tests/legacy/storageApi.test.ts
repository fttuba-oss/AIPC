import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { LocalStorageManager, type StoredExercise, type StoredSubmission } from '../../src/legacy/backend/storage/localStorageManager';

test('LocalStorageManager: Studio Storage & App Split Verification', async (t) => {
  const testStorageDir = path.resolve(process.cwd(), 'scratch', 'test_storage');
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }

  const manager = new LocalStorageManager(testStorageDir);

  await t.test('1. Initializes storage folders and seeds default roster', () => {
    const students = manager.getStudents();
    assert.strictEqual(students.length >= 3, true);
    assert.strictEqual(students[0].id, 'stud_alex');
    assert.strictEqual(students[0].name, 'Alex Morgan');
  });

  await t.test('2. Saves and retrieves an assigned exercise for a specific student', () => {
    const newExercise: StoredExercise = {
      id: 'ex_test_chloe_1',
      title: 'Galante: Sailing with Whales - Ostinato Practice',
      scoreTitle: 'Galante: Sailing with Whales',
      scorePath: '/sailing_with_whales_trumpet1.musicxml',
      instrumentId: 'trumpet',
      instrumentName: 'Trumpet 1',
      studentId: 'stud_chloe',
      studentName: 'Chloe Tan',
      assignedDate: new Date().toISOString(),
      status: 'assigned',
      section: {
        sectionNumber: 1,
        title: 'Section 1 (Bars 1–5)',
        startMeasure: 1,
        endMeasure: 5,
        goals: [
          {
            category: 'complex_rhythm',
            measureRange: 'Bars 1–5',
            startMeasure: 1,
            endMeasure: 5,
            goal: 'Maintain steady tempo on opening fanfare',
            targetTempo: 80,
            teacherNote: 'Do not rush beat 3'
          }
        ]
      },
      teacherGeneralNotes: 'Practice 10 mins daily'
    };

    manager.saveExercise(newExercise);

    const retrieved = manager.getExerciseById('ex_test_chloe_1');
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.studentId, 'stud_chloe');
    assert.strictEqual(retrieved?.section.startMeasure, 1);
    assert.strictEqual(retrieved?.section.endMeasure, 5);

    // Filter by student
    const chloeExercises = manager.getExercises('stud_chloe');
    assert.strictEqual(chloeExercises.length, 1);
    assert.strictEqual(chloeExercises[0].id, 'ex_test_chloe_1');
  });

  await t.test('3. Saves student submission linked to exercise, session and diagnostic telemetry', () => {
    const submission: StoredSubmission = {
      id: 'sub_test_chloe_sess1',
      exerciseId: 'ex_test_chloe_1',
      sessionId: 'sess_chloe_123',
      studentId: 'stud_chloe',
      studentName: 'Chloe Tan',
      pieceName: 'Galante: Sailing with Whales',
      instrumentName: 'Trumpet 1',
      submittedAt: new Date().toISOString(),
      sectionId: 'sec_1',
      sectionName: 'Section 1 (Bars 1–5)',
      measureRange: [1, 5],
      timeSpentSeconds: 420,
      takes: [
        {
          id: 'take_1',
          takeNumber: 1,
          timestamp: new Date().toISOString(),
          mode: 'audio',
          mediaFile: '/api/storage/recordings/take_1.webm',
          durationSeconds: 32,
          tempoUsed: 80,
          selfRating: 4
        }
      ],
      diagnosticResult: {
        overallAccuracyPercent: 92,
        summaryText: 'Excellent timing stability with minimal rushing in Bar 3.',
        problemMeasureNumbers: [3],
        rushedCount: 1,
        draggedCount: 0,
        stableCount: 14
      }
    };

    manager.saveSubmission(submission);

    const retrievedSub = manager.getSubmissionById('sub_test_chloe_sess1');
    assert.ok(retrievedSub);
    assert.strictEqual(retrievedSub?.exerciseId, 'ex_test_chloe_1');
    assert.strictEqual(retrievedSub?.studentId, 'stud_chloe');
    assert.strictEqual(retrievedSub?.diagnosticResult?.overallAccuracyPercent, 92);
    assert.deepStrictEqual(retrievedSub?.diagnosticResult?.problemMeasureNumbers, [3]);

    // Check that associated exercise status was updated to completed
    const updatedEx = manager.getExerciseById('ex_test_chloe_1');
    assert.strictEqual(updatedEx?.status, 'completed');
  });

  await t.test('4. Updates teacher feedback for submission', () => {
    manager.updateSubmissionFeedback('sub_test_chloe_sess1', 'Super job Chloe! Your high notes were spot-on.');
    const updatedSub = manager.getSubmissionById('sub_test_chloe_sess1');
    assert.strictEqual(updatedSub?.teacherFeedback, 'Super job Chloe! Your high notes were spot-on.');
  });

  await t.test('5. Saves and streams audio recording file', () => {
    const fakeAudioBuffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]); // webm header snippet
    const mediaUrl = manager.saveRecording('take_test_audio.webm', fakeAudioBuffer);
    assert.strictEqual(mediaUrl, '/api/storage/recordings/take_test_audio.webm');

    const filePath = manager.getRecordingPath('take_test_audio.webm');
    assert.ok(filePath);
    assert.strictEqual(fs.existsSync(filePath!), true);
  });

  await t.test('6. Distributes practice plan exercises across targeted section roster', () => {
    const students = manager.getStudents();
    const woodwindStudents = students.filter(st => {
      const inst = st.instrument.toLowerCase();
      return inst.includes('flute') || inst.includes('clarinet');
    });

    assert.ok(woodwindStudents.length >= 1);
    
    // Assign exercise to each woodwind student
    for (const student of woodwindStudents) {
      manager.saveExercise({
        id: `ex_danxia_ww_${student.id}`,
        title: 'Danxia Woodwinds Syncopation - Bars 27–28',
        scoreTitle: 'Beautiful Danxia',
        scorePath: '/beautiful_danxia_flutes.musicxml',
        instrumentId: student.instrument.toLowerCase().replace(/\s+/g, '_'),
        instrumentName: student.instrument,
        studentId: student.id,
        studentName: student.name,
        assignedDate: new Date().toISOString(),
        status: 'assigned',
        section: {
          sectionNumber: 1,
          title: 'Bars 27–28',
          startMeasure: 27,
          endMeasure: 28,
          goals: []
        }
      });
    }

    const firstStudentEx = manager.getExercises(woodwindStudents[0].id);
    assert.strictEqual(firstStudentEx.length >= 1, true);
    assert.strictEqual(firstStudentEx[0].scoreTitle, 'Beautiful Danxia');
  });

  await t.test('7. Deletes assigned exercise cleanly', () => {
    const deleted = manager.deleteExercise('ex_test_chloe_1');
    assert.strictEqual(deleted, true);
    const checkEx = manager.getExerciseById('ex_test_chloe_1');
    assert.strictEqual(checkEx, null);
  });

  // Cleanup test folder
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
});
