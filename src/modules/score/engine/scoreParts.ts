/** Parts of a score, read straight from its MusicXML part list (fast, no engraving needed). */
export type PartSection = 'Woodwinds' | 'Saxophones' | 'Brass' | 'Percussion' | 'Other';

export interface ScorePartInfo {
  id: string;        // MusicXML score-part id (also OSMD's instrument IdString)
  name: string;
  section: PartSection;
}

const SECTION_RULES: [PartSection, string[]][] = [
  ['Saxophones', ['sax']],
  ['Woodwinds', ['flute', 'piccolo', 'oboe', 'bassoon', 'clarinet', 'recorder']],
  ['Brass', ['trumpet', 'cornet', 'flugel', 'horn', 'trombone', 'euph', 'baritone', 'tuba', 'sousaphone']],
  ['Percussion', ['timpani', 'perc', 'drum', 'cymbal', 'glock', 'bells', 'xylophone', 'marimba', 'vibraphone', 'triangle', 'tambourine', 'tam', 'chimes', 'gong', 'bass d', 'snare', 'tom', 'wood block', 'woodblock', 'cowbell', 'sus', 'timbales', 'crotales']],
];

export function sectionOf(name: string): PartSection {
  const n = name.toLowerCase();
  for (const [section, words] of SECTION_RULES) {
    if (words.some(w => n.includes(w))) return section;
  }
  return 'Other';
}

export function listScoreParts(xml: string | null | undefined): ScorePartInfo[] {
  if (!xml) return [];
  try {
    const doc = new DOMParser().parseFromString(xml.replace(/&amp;amp;/g, '&amp;'), 'application/xml');
    return Array.from(doc.getElementsByTagName('score-part')).map((sp, i) => {
      const name = (sp.getElementsByTagName('part-name')[0]?.textContent || sp.getElementsByTagName('instrument-name')[0]?.textContent || `Part ${i + 1}`)
        .replace(/\s+/g, ' ').trim();
      return { id: sp.getAttribute('id') || `P${i + 1}`, name, section: sectionOf(name) };
    });
  } catch {
    return [];
  }
}

const FAMILIES = ['piccolo', 'flute', 'oboe', 'bassoon', 'clarinet', 'sax', 'trumpet', 'cornet', 'horn', 'trombone', 'euph', 'baritone', 'tuba', 'timpani', 'perc'];
const ORDINALS: Record<string, number> = { '1st': 1, first: 1, '2nd': 2, second: 2, '3rd': 3, third: 3, '4th': 4, fourth: 4 };

function numberIn(text: string): number | null {
  const m = text.toLowerCase().match(/\b(\d)(?:st|nd|rd|th)?\b/);
  if (m) return parseInt(m[1], 10);
  for (const [w, v] of Object.entries(ORDINALS)) if (text.toLowerCase().includes(w)) return v;
  return null;
}

/** Best guess of which score part a student's instrument ("Flute 2", "Trumpet 1") plays. */
export function matchPartToInstrument(parts: ScorePartInfo[], instrument: string): string | null {
  if (parts.length === 0) return null;
  const inst = instrument.toLowerCase();
  const fam = FAMILIES.find(f => inst.includes(f));
  const candidates = fam ? parts.filter(p => p.name.toLowerCase().includes(fam)) : [];
  if (candidates.length === 0) return parts[0].id;
  const want = numberIn(instrument);
  if (want !== null) {
    const exact = candidates.find(p => numberIn(p.name) === want);
    if (exact) return exact.id;
    // a combined "1st & 2nd Flutes" part covers any number
    const combined = candidates.find(p => /(&|and)/.test(p.name) && p.name.match(/\d/g)?.includes(String(want)));
    if (combined) return combined.id;
  }
  return candidates[0].id;
}
