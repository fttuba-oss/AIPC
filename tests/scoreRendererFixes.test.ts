import test from 'node:test';
import assert from 'node:assert/strict';
import { installWavyLineStaffFix } from '../src/utils/scoreRendererFixes.ts';

test('cross-system trill rendering finds a visible staff by identity after other parts are hidden', () => {
  const staff = { isVisible: () => true };
  const line = { ParentStaff: staff, Measures: ['next-bar'] };
  const systems = [{ StaffLines: [line] }];
  const measures: any[] = []; measures[5] = { ParentStaff: staff };
  const calculator = { musicSystems: systems, graphicalMusicSheet: { MeasureList: [measures] },
    calculateSingleWavyLine(_s: unknown, _e: unknown, _m: number, staffIndex: number) { return this.musicSystems[0].StaffLines[staffIndex].Measures; } };
  installWavyLineStaffFix({ GraphicSheet: { GetCalculator: calculator } });
  assert.deepEqual(calculator.calculateSingleWavyLine(null, null, 0, 5), ['next-bar']);
  assert.equal(calculator.musicSystems, systems);
  assert.equal(systems[0].StaffLines.length, 1);
});
test('renderer adapter restores the original systems even if another calculation fails', () => {
  const staff = { isVisible: () => true }, systems = [{ StaffLines: [] }];
  const calculator = { musicSystems: systems, graphicalMusicSheet: { MeasureList: [[{ ParentStaff: staff }]] },
    calculateSingleWavyLine() { throw new Error('Different engraving error'); } };
  installWavyLineStaffFix({ GraphicSheet: { GetCalculator: calculator } });
  assert.throws(() => (calculator.calculateSingleWavyLine as any)(null, null, 0, 0), /Different engraving error/);
  assert.equal(calculator.musicSystems, systems);
});
