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
const ids = (numbers: number[]) => numbers.map(n => `P${n}`);
const bass = [4, 8, 12, 22, 23];
const span = (start: number, end: number, label: string, melody: number[], secondary: number[], secondaryLabel?: string): TextureSpan => ({
  start, end, label, melody: ids(melody), countermelody: ids(secondary),
  accompaniment: ids(Array.from({ length: 31 }, (_, i) => i + 1).filter(n => !melody.includes(n) && !secondary.includes(n))),
  secondaryLabel,
});
export const sunnyIslandTexture: TextureSpan[] = [
  span(1, 1, 'Introduction', [], []),
  span(2, 6, 'Opening melody', [5, 6, 7, 11], [16, 17], 'Answering lines'),
  span(7, 10, 'Opening continuation', [1, 2, 3, 5, 6, 7, 13, 14, 15], [9, 10, 16, 17], 'Answering lines'),
  span(11, 12, 'Transition', [], [], 'Supporting lines'),
  span(13, 20, 'A', [5, 6, 7, 9, 10], []),
  span(21, 28, 'A · fuller statement', [2, 3, 5, 6, 7, 9, 10, 13, 14, 15, 31], [11, 16, 17, 21]),
  span(29, 32, 'B · lower-band melody', [...bass, 11, 16, 17, 18, 19, 20, 21], []),
  span(33, 36, 'B · upper response', [2, 3, 5, 6, 7, 9, 10, 31], [11], 'Secondary line'),
  span(37, 40, 'C · lower-band melody', [...bass, 11, 16, 17, 18, 19, 20, 21], []),
  span(41, 44, 'C · upper response', [1, 2, 3, 5, 6, 7, 9, 10, 31], [4, 8, 12, 18, 19, 20, 21], 'Supporting responses'),
  span(45, 52, 'D', [1, 2, 3, 5, 6, 7, 13, 14, 15], [9, 10, 16, 17]),
  span(53, 54, 'Link to Dayung Sampan', [30], [], 'Supporting lines'),
  span(55, 64, 'E · Dayung Sampan', [21], [1, 2, 3, 5, 31], 'Decorations & replies'),
  span(65, 74, 'F · Dayung Sampan', [13, 14, 15], [4, 11, 21]),
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
