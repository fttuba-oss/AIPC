/** Display-only convention; never rewrite the source used for playback or analysis. */
export function notationPlacement(voice: string, voices: string[]): 'above' | 'below' {
  return voices.length > 1 && voices.indexOf(voice) > 0 ? 'below' : 'above';
}

export function prepareScoreForDisplay(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The score contains invalid MusicXML.');
  // Sunny Island's opening heading includes a separate printed "(~80)" hint.
  // Remove that hint only; retain Andante, the metronome mark and sound tempo.
  for (const direction of Array.from(doc.getElementsByTagName('direction'))) {
    const words = Array.from(direction.getElementsByTagName('words'));
    if (!words.some(w => /Infinite Dreams/i.test(w.textContent || '')) || !words.some(w => /^~\s*80\s*\)$/.test((w.textContent || '').trim()))) continue;
    for (const word of words) if (/^(?:\(|~\s*80\s*\))$/.test((word.textContent || '').trim())) word.remove();
    for (const type of Array.from(direction.children)) if (type.localName === 'direction-type' && !type.children.length) type.remove();
  }
  for (const part of Array.from(doc.getElementsByTagName('part'))) {
    const staffVoices = new Map<string, Set<string>>();
    const notes = Array.from(part.getElementsByTagName('note'));
    const staffOf = (note: Element) => note.getElementsByTagName('staff')[0]?.textContent || '1';
    const voiceOf = (note: Element) => note.getElementsByTagName('voice')[0]?.textContent || '1';
    for (const note of notes) {
      if (note.getElementsByTagName('rest').length) continue;
      const staff = staffOf(note);
      if (!staffVoices.has(staff)) staffVoices.set(staff, new Set());
      staffVoices.get(staff)!.add(voiceOf(note));
    }
    for (const note of notes) {
      const voices = [...(staffVoices.get(staffOf(note)) || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const placement = notationPlacement(voiceOf(note), voices);
      for (const articulations of Array.from(note.getElementsByTagName('articulations'))) {
        for (const mark of Array.from(articulations.children)) {
          // Breath/caesura and specialist techniques retain their renderer-specific rules.
          if (!['staccato', 'staccatissimo', 'accent', 'strong-accent', 'tenuto', 'detached-legato'].includes(mark.tagName)) continue;
          if (!mark.hasAttribute('placement')) mark.setAttribute('placement', placement);
        }
      }
      for (const slur of Array.from(note.getElementsByTagName('slur'))) {
        if (!slur.hasAttribute('placement')) slur.setAttribute('placement',
          slur.getAttribute('orientation') === 'under' ? 'below' : slur.getAttribute('orientation') === 'over' ? 'above' : placement);
      }
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
