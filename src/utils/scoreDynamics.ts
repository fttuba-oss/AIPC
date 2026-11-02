export interface DynamicPoint {
    beat: number;
    level: number;
    ramp?: boolean;
}
export interface PartDynamics {
    partId: string;
    staff: number;
    points: DynamicPoint[];
}
export const REFERENCE_DYNAMIC = 0.75;
export const DYNAMIC_LEVELS: Record<string, number> = {
    pppppp: 5 / 127, ppppp: 8 / 127, pppp: 12 / 127, ppp: 20 / 127, pp: 33 / 127,
    p: 49 / 127, mp: 64 / 127, mf: 80 / 127, f: 96 / 127, ff: 112 / 127, fff: 124 / 127, ffff: 1,
};
export function dynamicAt(points: readonly DynamicPoint[], beat: number): number {
    let previous: DynamicPoint = { beat: -Infinity, level: REFERENCE_DYNAMIC };
    for (const point of points) {
        if (point.beat > beat + 1e-7) {
            if (point.ramp && Number.isFinite(previous.beat) && point.beat > previous.beat) {
                return previous.level + (point.level - previous.level) * Math.max(0, (beat - previous.beat) / (point.beat - previous.beat));
            }
            break;
        }
        previous = point;
    }
    return previous.level;
}
export function partDynamicAt(tracks: readonly PartDynamics[], id: string, beat: number, staff?: number): number {
    const selected = tracks.filter(t => t.partId === id && (staff === undefined || t.staff === staff));
    return selected.length ? Math.max(...selected.map(t => dynamicAt(t.points, beat))) : REFERENCE_DYNAMIC;
}
/** MusicXML directions are timed with divisions, offsets, backup/forward and chord/grace semantics. */
export function readScoreDynamics(document: Document, measureStarts: readonly number[]): PartDynamics[] {
    const children = (el: Element, name: string) => Array.from(el.children).filter(c => c.localName === name);
    const number = (el: Element, name: string, fallback = 0) => { const text = children(el, name)[0]?.textContent?.trim(); const value = text ? Number(text) : fallback; return Number.isFinite(value) ? value : fallback; };
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const result: PartDynamics[] = [];
    const root = document.documentElement;
    const parts = new Map<string, Element[]>();
    if (root.localName === 'score-partwise')
        for (const p of children(root, 'part'))
            parts.set(p.getAttribute('id') || '', children(p, 'measure'));
    else if (root.localName === 'score-timewise')
        for (const m of children(root, 'measure'))
            for (const p of children(m, 'part')) {
                const id = p.getAttribute('id') || '';
                if (!parts.has(id))
                    parts.set(id, []);
                parts.get(id)!.push(p);
            }
    for (const [partId, measures] of parts) {
        type Event = {
            beat: number;
            staff?: number;
            level?: number;
            accent?: string;
            wedge?: string;
            number?: string;
        };
        const events: Event[] = [];
        let divisions = 1, staffCount = 1;
        measures.forEach((measure, index) => {
            let cursor = 0;
            for (const el of Array.from(measure.children)) {
                if (el.localName === 'attributes') {
                    divisions = Math.max(1, number(el, 'divisions', divisions));
                    staffCount = Math.max(staffCount, number(el, 'staves', 1));
                }
                else if (el.localName === 'backup')
                    cursor -= number(el, 'duration') / divisions;
                else if (el.localName === 'forward')
                    cursor += number(el, 'duration') / divisions;
                else if (el.localName === 'note' && !children(el, 'chord').length && !children(el, 'grace').length)
                    cursor += number(el, 'duration') / divisions;
                else if (el.localName === 'direction' || el.localName === 'sound') {
                    const beat = (measureStarts[index] ?? 0) + cursor + number(el, 'offset') / divisions;
                    const staff = number(el, 'staff', 0) || undefined;
                    staffCount = Math.max(staffCount, staff ?? 1);
                    const sounds = el.localName === 'sound' ? [el] : children(el, 'sound');
                    const sound = sounds.find(s => s.hasAttribute('dynamics'));
                    const types = children(el, 'direction-type');
                    const mark = types.flatMap(t => children(t, 'dynamics')).flatMap(d => Array.from(d.children))[0]?.localName;
                    const explicit = sound ? Number(sound.getAttribute('dynamics')) : undefined;
                    if (explicit !== undefined && Number.isFinite(explicit))
                        events.push({ beat, staff, level: clamp(explicit * .9 / 127) });
                    else if (mark && DYNAMIC_LEVELS[mark] !== undefined)
                        events.push({ beat, staff, level: DYNAMIC_LEVELS[mark] });
                    else if (mark && ['fp', 'sfp', 'sf', 'sfz', 'sffz', 'rf', 'rfz', 'fz'].includes(mark))
                        events.push({ beat, staff, accent: mark });
                    for (const wedge of types.flatMap(t => children(t, 'wedge')))
                        events.push({ beat, staff, wedge: wedge.getAttribute('type') || '', number: wedge.getAttribute('number') || '1' });
                }
            }
        });
        events.sort((a, b) => a.beat - b.beat);
        for (let staff = 1; staff <= staffCount; staff++) {
            const selected = events.filter(e => e.staff === undefined || e.staff === staff);
            const points: DynamicPoint[] = [{ beat: Math.min(0, selected[0]?.beat ?? 0), level: REFERENCE_DYNAMIC }];
            const open = new Map<string, {
                beat: number;
                level: number;
                direction: string;
            }>();
            const put = (point: DynamicPoint) => { const existing = points.find(p => Math.abs(p.beat - point.beat) < 1e-7); if (existing) {
                existing.level = point.level;
                existing.ramp = existing.ramp || point.ramp;
            }
            else
                points.push(point); points.sort((a, b) => a.beat - b.beat); };
            for (const event of selected) {
                if (event.level !== undefined)
                    put({ beat: event.beat, level: event.level });
                if (event.accent) {
                    const previous = dynamicAt(points, event.beat);
                    put({ beat: event.beat, level: event.accent === 'sffz' ? 1 : DYNAMIC_LEVELS.f });
                    put({ beat: event.beat + .2, level: event.accent.includes('p') ? DYNAMIC_LEVELS.p : previous });
                }
                if (event.wedge === 'crescendo' || event.wedge === 'diminuendo') {
                    const level = dynamicAt(points, event.beat);
                    put({ beat: event.beat, level });
                    open.set(event.number!, { beat: event.beat, level, direction: event.wedge });
                }
                else if (event.wedge === 'stop') {
                    const start = open.get(event.number!);
                    if (!start)
                        continue;
                    const next = selected.find(e => e.level !== undefined && e.beat >= event.beat - 1e-7 && e.beat <= event.beat + 4);
                    const target = next?.level ?? clamp(start.level + (start.direction === 'crescendo' ? .16 : -.16));
                    // An unspecified target is a modest step. Explicit nearby targets take priority.
                    put({ beat: event.beat, level: target, ramp: true });
                    open.delete(event.number!);
                }
            }
            // Without a closing wedge, do not invent an unlimited crescendo.
            result.push({ partId, staff, points });
        }
    }
    return result;
}
