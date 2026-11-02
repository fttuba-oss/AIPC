/** Curated score annotations, not an automatic texture classifier.
 * See docs/musical-reasoning. Bind to the analysed XML, never just its title.
 */
export type PracticeMode = 'own' | 'lines' | 'instruments';
export type TextureRole = 'melody' | 'countermelody' | 'accompaniment';
export interface TextureSpan {
  start: number; end: number; label: string;
  melody: string[]; countermelody: string[]; accompaniment: string[];
  secondaryLabel?: string;
}
export interface PartRoleSegment {
  start: number; end: number; role: TextureRole | 'rest'; label: string;
}
/** Adjacent phrases with the same role become one structural span; full-bar rests stay explicit. */
export function partRoleSegments(spans: TextureSpan[] | null, partId: string | null, activeMeasures?: Set<number>): PartRoleSegment[] {
  if (!spans || !partId) return [];
  const result: PartRoleSegment[] = [];
  for (const span of spans) for (let bar = span.start; bar <= span.end; bar++) {
    const role = activeMeasures && !activeMeasures.has(bar) ? 'rest'
      : (['melody', 'countermelody', 'accompaniment'] as TextureRole[]).find(r => span[r].includes(partId));
    if (!role) continue;
    const label = role === 'rest' ? 'Resting' : role === 'melody' ? 'Melody'
      : role === 'accompaniment' ? 'Accompaniment' : span.secondaryLabel || 'Countermelody';
    const previous = result.at(-1);
    if (previous?.role === role && previous.label === label && previous.end === bar - 1) previous.end = bar;
    else result.push({ start: bar, end: bar, role, label });
  }
  return result;
}
const ids = (numbers: number[]) => numbers.map(n => `P${n}`);
const bass = [4, 8, 12, 22, 23];
const span = (start: number, end: number, label: string, melody: number[], secondary: number[], secondaryLabel?: string): TextureSpan => ({
  start, end, label, melody: ids(melody), countermelody: ids(secondary),
  accompaniment: ids(Array.from({ length: 31 }, (_, i) => i + 1).filter(n => !melody.includes(n) && !secondary.includes(n))),
  secondaryLabel,
});
export const sunnyIslandTexture: TextureSpan[] = [
  span(1, 1, 'Introduction', [], []),
  span(2, 5, 'Opening melody', [5, 6, 7, 11], [16, 17], 'Answering lines'),
  span(6, 6, 'Opening handoff · pickup', [1, 2, 3, 5, 6, 7, 11, 13, 14, 15], [9, 10, 16, 17], 'Answering lines'),
  span(7, 10, 'Opening continuation', [1, 2, 3, 5, 6, 7, 13, 14, 15], [9, 10, 16, 17], 'Answering lines'),
  span(11, 12, 'Transition', [], [], 'Supporting lines'),
  span(13, 19, 'A', [5, 6, 7, 9, 10], []),
  span(20, 28, 'A · fuller statement · pickup in 20', [2, 3, 5, 6, 7, 9, 10, 13, 14, 15, 31], [11, 16, 17, 21]),
  span(29, 31, 'B · lower-band melody', [...bass, 11, 16, 17, 18, 19, 20, 21], []),
  span(32, 32, 'B · melodic handoff', [...bass, 2, 3, 5, 6, 7, 9, 10, 11, 16, 17, 18, 19, 20, 21, 31], []),
  span(33, 36, 'B · upper response', [2, 3, 5, 6, 7, 9, 10, 31], [11], 'Secondary line'),
  span(37, 39, 'C · lower-band melody', [...bass, 11, 16, 17, 18, 19, 20, 21], []),
  span(40, 40, 'C · melodic handoff', [...bass, 1, 2, 3, 5, 6, 7, 9, 10, 11, 16, 17, 18, 19, 20, 21, 31], []),
  span(41, 44, 'C · upper response', [1, 2, 3, 5, 6, 7, 9, 10, 31], [4, 8, 12, 18, 19, 20, 21], 'Supporting responses'),
  span(45, 52, 'D', [1, 2, 3, 5, 6, 7, 13, 14, 15], [9, 10, 16, 17]),
  span(53, 53, 'D · closing handoff', [1, 2, 3, 5, 6, 7, 13, 14, 15, 30], [9, 10, 16, 17]),
  span(54, 54, 'Link to Dayung Sampan', [30], [], 'Supporting lines'),
  span(55, 63, 'E · Dayung Sampan', [21], [1, 2, 3, 5, 31], 'Decorations & replies'),
  span(64, 64, 'E · upper-wind link', [1, 2, 3, 5, 31], [], 'Supporting lines'),
  span(65, 73, 'F · Dayung Sampan', [13, 14, 15], [4, 11, 21]),
  span(74, 74, 'F · upper-wind link', [1, 2, 3, 5, 31], [4, 11, 21]),
  span(75, 78, 'G', [2, 3, 5, 6, 31], [7, 9, 10, 16, 17], 'Other supporting lines'),
  span(79, 82, 'G · continuation', [2, 3], [16, 17], 'Other supporting lines'),
  span(83, 86, 'G · transition', [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 21], [], 'Supporting lines'),
  span(87, 96, 'H · Dayung Sampan', [13, 14, 15, 18, 19, 20, 21], [1, 2, 3, 5, 6, 7, 31]),
  span(97, 112, 'I', [11, 13, 14, 15, 18, 19, 20, 21], [1, 2, 3, 5, 6, 7, 9, 10, 31]),
  span(113, 116, 'J · Ending', [1, 2, 3, 5, 6, 7, 9, 10, 30], []),
];

export function scoreFingerprint(xml: string): string {
  const text = xml.trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function textureForScore(xml?: string | null): TextureSpan[] | null {
  return xml && scoreFingerprint(xml) === 'f382fe51' ? sunnyIslandTexture : null;
}
export function textureAtMeasure(spans: TextureSpan[] | null, measure: number): TextureSpan | undefined {
  return spans?.find(s => measure >= s.start && measure <= s.end);
}
/** Keep saved choices, but suspend a line whenever the student carries it. */
export function availablePracticeRoles(roles: TextureRole[], span: TextureSpan | undefined, ownPart: string | null): TextureRole[] {
  return roles.filter(role => !ownPart || !span?.[role].includes(ownPart));
}
export function selectedPracticePart(mode: PracticeMode, roles: TextureRole[], span: TextureSpan | undefined,
  partId: string, ownPart: string | null, instrumentEnabled: boolean): boolean {
  if (partId === ownPart || ownPart === null) return true; // With no part list, the caller supplies only the own-part fallback.
  if (mode === 'own') return false;
  if (mode === 'instruments') return instrumentEnabled;
  return availablePracticeRoles(roles, span, ownPart).some(role => span?.[role].includes(partId));
}
