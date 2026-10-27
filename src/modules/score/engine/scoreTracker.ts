/** Coordinates in the rendered score wrapper; beat is an absolute quarter-note beat. */
export interface TrackerAnchor {
  beat: number;
  x: number;
  top: number;
  height: number;
  system: number;
}

export interface TrackerMeasure {
  beat: number;
  endBeat: number;
  left: number;
  right: number;
  top: number;
  height: number;
  system: number;
  entries: { beat: number; x: number; isNote?: boolean }[];
}

/** Rest glyphs never anchor time; pitched attacks use the notehead's left edge. */
export function buildTrackerAnchors(measures: readonly TrackerMeasure[]): TrackerAnchor[] {
  const anchors: TrackerAnchor[] = [];
  for (const measure of [...measures].sort((a, b) => a.beat - b.beat)) {
    if (!(measure.endBeat > measure.beat) || !Number.isFinite(measure.left) || !Number.isFinite(measure.right)) continue;
    const geometry = { top: measure.top, height: measure.height, system: measure.system };
    const downbeat = measure.entries.filter(entry => entry.isNote && entry.beat === measure.beat && Number.isFinite(entry.x));
    const startX = downbeat.length ? Math.max(measure.left, Math.min(measure.right, ...downbeat.map(entry => entry.x))) : measure.left;
    anchors.push({ ...geometry, beat: measure.beat, x: startX });
    // Interior attacks still follow the actual engraving; bar endpoints are explicit,
    // even when the visible part has no notes or no event exactly on beat one.
    let x = startX;
    for (const entry of [...measure.entries].sort((a, b) => a.beat - b.beat)) {
      if (entry.beat <= measure.beat || entry.beat >= measure.endBeat || !Number.isFinite(entry.x)) continue;
      x = Math.max(x, Math.min(measure.right, entry.x));
      anchors.push({ ...geometry, beat: entry.beat, x });
    }
    anchors.push({ ...geometry, beat: measure.endBeat, x: measure.right });
  }
  // At a shared boundary, the following bar's start wins over the preceding bar's end.
  return anchors.sort((a, b) => a.beat - b.beat);
}

/** Equal-time anchors are intentional at line breaks: exit the old line, enter the new. */
export function trackerPositionAt(anchors: readonly TrackerAnchor[], beat: number): TrackerAnchor | null {
  if (!anchors.length || !Number.isFinite(beat)) return null;
  if (beat < anchors[0].beat) return anchors[0];
  let lo = 0, hi = anchors.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (anchors[mid].beat <= beat) lo = mid + 1;
    else hi = mid;
  }
  const a = anchors[Math.max(0, lo - 1)];
  const b = anchors[lo];
  if (!b || a.system !== b.system || b.beat <= a.beat) return a;
  const fraction = Math.max(0, Math.min(1, (beat - a.beat) / (b.beat - a.beat)));
  return { ...a, x: a.x + (b.x - a.x) * fraction };
}
