/** Coordinates in the rendered score wrapper; beat is an absolute quarter-note beat. */
export interface TrackerAnchor {
  beat: number;
  x: number;
  top: number;
  height: number;
  system: number;
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
