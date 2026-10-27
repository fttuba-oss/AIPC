import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
export function captureTrackerScore() {
  const original = OpenSheetMusicDisplay.prototype.render;
  OpenSheetMusicDisplay.prototype.render = function(...args: []) {
    (window as any).__trackerScore = this;
    return original.apply(this, args);
  };
}
export function barGeometry(number: number) {
  const osmd = (window as any).__trackerScore;
  const measure = osmd.GraphicSheet.MeasureList.flat().find((m: any) => m?.MeasureNumber === number && m.isVisible() && m.getVFStave?.().width > 0);
  const stave = measure.getVFStave();
  const cursor = document.querySelector<HTMLElement>('[data-score-cursor]')!;
  const wrapper = cursor.parentElement!;
  const svgs = wrapper.querySelectorAll('svg');
  const page = measure.ParentMusicSystem.Parent?.PageNumber || 1;
  const svg = svgs[page - 1] || svgs[0];
  const point = new DOMPoint(stave.x, stave.getYForLine(0)).matrixTransform(svg.getScreenCTM()!);
  const right = new DOMPoint(stave.x + stave.width - 3, 0).matrixTransform(svg.getScreenCTM()!);
  return { left: point.x, right: right.x, cursor: cursor.getBoundingClientRect().left, top: point.y, cursorTop: cursor.getBoundingClientRect().top };
}

export function noteGeometry(beat: number) {
  const osmd = (window as any).__trackerScore;
  let left = Infinity;
  for (const row of osmd.GraphicSheet.MeasureList) for (const measure of row) {
    if (!measure?.isVisible()) continue;
    for (const entry of measure.staffEntries || []) {
      if (Math.abs(entry.getAbsoluteTimestamp().RealValue * 4 - beat) > 1e-6) continue;
      for (const voice of entry.graphicalVoiceEntries || []) for (const note of voice.notes || []) {
        if (note.sourceNote.isRest()) continue;
        for (const head of note.getNoteheadSVGs?.() || []) {
          const rect = head.getBoundingClientRect();
          if (rect.width) left = Math.min(left, rect.left);
        }
      }
    }
  }
  return { left, cursor: document.querySelector('[data-score-cursor]')!.getBoundingClientRect().left };
}
