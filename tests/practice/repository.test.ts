import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PracticeRepository } from '../../src/modules/practice/repository';
const draft = { teacherId: 'teacher1', title: 'Practise bars', score: { id: 'one', title: 'Piece', xmlPath: '/piece.musicxml' }, studentId: 's1', studentName: 'Untrusted name', instrumentName: '', range: [1, 2] as [number, number], notes: 'Steady tempo' };
test('dispatch, persistent completion, reopening, and student/teacher isolation', () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aipc-plans-'));
 try {
  fs.writeFileSync(path.join(root,'students.json'), JSON.stringify([{ id: 's1', name: 'Student one', instrument: 'Flute' }, {id:'s2',name:'Student two',instrument:'Tuba'}]));
  let repository = new PracticeRepository(root);
  const plan = repository.dispatch(draft);
  assert.equal(plan.studentName, 'Student one');
  assert.equal(repository.plans({ studentId: 's2' }).length, 0);
  assert.equal(repository.plans({ teacherId: 'other' }).length, 0);
  assert.throws(() => repository.setStatus(plan.id, 's2', 'completed'), /not found/);
  repository.setStatus(plan.id, 's1', 'completed');
  repository = new PracticeRepository(root);
  assert.equal(repository.plans({ teacherId: 'teacher1' })[0].status, 'completed');
  repository.setStatus(plan.id, 's1', 'assigned');
  assert.equal(repository.plans()[0].status, 'assigned');
  assert.throws(() => repository.dispatch({ ...draft, range: [3, 1] }), /range/);
  assert.throws(() => repository.dispatch({ ...draft, studentId: 'missing' }), /roster/);
  assert.throws(() => repository.setStatus('../escape', 's1', 'completed'), /Invalid/);
  assert.throws(() => repository.setStatus(plan.id, 's1', 'fake' as any), /status/);
 } finally { fs.rmSync(root, { recursive:true, force:true }); }
});
test('legacy assignments remain visible and completion overrides do not mutate original files', () => {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aipc-legacy-'));
 try {
  fs.mkdirSync(path.join(root,'exercises'));
  const legacy = { id:'legacy1',title:'Old plan',studentId:'s1',studentName:'Student',instrumentName:'Flute',scoreTitle:'Piece',scorePath:'/piece.xml',assignedDate:'2026-01-01',status:'assigned',section:{startMeasure:1,endMeasure:2,goals:[]} };
  const file = path.join(root,'exercises','legacy1.json'); fs.writeFileSync(file, JSON.stringify(legacy));
  const repo = new PracticeRepository(root);
  assert.equal(repo.plans({ studentId:'s1' }).length,1);
  repo.setStatus('legacy1','s1','completed');
  assert.equal(repo.plans().length,1); assert.equal(repo.plans()[0].status,'completed');
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).status,'assigned');
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
