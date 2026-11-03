/** OSMD 2.1.2 indexes cross-system trill continuations by the full-score staff
 * index, even when the displayed systems contain only selected staves. This
 * can clear the SVG then throw on `undefined.Measures` during a reflow.
 * Adapt that one calculation; keep the actual staff arrays and trill notation.
 */
const installed = Symbol('aipc-wavy-staff-fix');
export function installWavyLineStaffFix(osmd: { GraphicSheet?: any }): void {
  const calculator = osmd.GraphicSheet?.GetCalculator;
  if (!calculator || calculator[installed] || typeof calculator.calculateSingleWavyLine !== 'function') return;
  calculator[installed] = true;
  const original = calculator.calculateSingleWavyLine;
  calculator.calculateSingleWavyLine = function (source: unknown, expression: unknown, measureIndex: number, staffIndex: number) {
    const staff = this.graphicalMusicSheet?.MeasureList?.[measureIndex]?.[staffIndex]?.ParentStaff;
    if (!staff || staff.isVisible?.() === false) return;
    const systems = this.musicSystems;
    if (!Array.isArray(systems)) return original.call(this, source, expression, measureIndex, staffIndex);
    // Only this synchronous renderer call sees the index adapter. The underlying
    // MusicSystem instances, StaffLines and ParentStaff identities are untouched.
    this.musicSystems = systems.map(system => new Proxy(system, {
      get(target, key) {
        if (key !== 'StaffLines') return Reflect.get(target, key, target);
        const lines = target.StaffLines;
        const matching = lines.find((line: any) => line.ParentStaff === staff);
        const indexed = [...lines];
        indexed[staffIndex] = matching;
        return indexed;
      },
    }));
    try { return original.call(this, source, expression, measureIndex, staffIndex); }
    finally { this.musicSystems = systems; }
  };
}
