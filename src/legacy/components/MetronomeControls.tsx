import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { countInPulses, pulseQuarterNotes, type MetronomeSubdivision } from '../../modules/score/engine/metronome';
import { subdivisionNotation } from '../../modules/score/engine/subdivisionNotation';

export function SubdivisionIcon({ pulse, subdivision, className = '' }: {
  pulse: number; subdivision: MetronomeSubdivision; className?: string;
}) {
  const n = subdivisionNotation(pulse, subdivision);
  const width = n.count === 1 ? 31 : n.count * 22 + 7;
  const stemTop = n.tuplet ? 14 : 7;
  return <svg viewBox={`0 0 ${width} 43`} aria-hidden="true" focusable="false" className={className}>
    {n.tuplet && <text x={width / 2} y={9} fill="currentColor" textAnchor="middle" fontSize="10" fontStyle="italic">3</text>}
    {Array.from({ length: n.count }, (_, i) => {
      const x = 9 + i * 22;
      return <g key={i} fill="currentColor" stroke="currentColor">
        <ellipse cx={x} cy={32} rx={4.3} ry={3} transform={`rotate(-20 ${x} 32)`} fill={n.openHead ? 'none' : 'currentColor'} strokeWidth={n.openHead ? 1.7 : 0} />
        {!n.whole && <path d={`M${x + 3.6} 31V${stemTop}`} fill="none" strokeWidth="1.6" />}
        {n.dotted && <circle cx={x + 8} cy={30} r={1.5} stroke="none" />}
        {n.count === 1 && Array.from({ length: n.flags }, (_, f) => <path key={f}
          d={`M${x + 3.6} ${stemTop + f * 5}q11 5 4 15q4-8-4-10`} stroke="none" />)}
      </g>;
    })}
    {n.count > 1 && Array.from({ length: n.flags }, (_, f) => <path key={f}
      d={`M12.6 ${stemTop + f * 5}H${12.6 + (n.count - 1) * 22}`} stroke="currentColor" strokeWidth="3" />)}
  </svg>;
}
interface Props {
  quarterBpm: number;
  numerator: number;
  denominator: number;
  subdivision: MetronomeSubdivision;
  muted: boolean;
  countIn: boolean;
  activeBeat: number | null;
  onBpmChange: (quarterBpm: number) => void;
  onSubdivisionChange: (subdivision: MetronomeSubdivision) => void;
  onMutedChange: (muted: boolean) => void;
  onCountInChange: (enabled: boolean) => void;
}
const choices: MetronomeSubdivision[] = ['quarter', 'eighth', 'triplet', 'sixteenth'];
export function MetronomeControls(props: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pulse = pulseQuarterNotes(props.numerator, props.denominator);
  const bpm = Math.round(props.quarterBpm / pulse);
  const count = countInPulses(props.numerator, props.denominator);
  const min = Math.ceil(30 / pulse), max = Math.floor(260 / pulse);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const changeTempo = (value: number) => props.onBpmChange(Math.max(min, Math.min(max, value)) * pulse);
  return <div ref={root} className="relative flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/80">
      <span className="flex items-center text-sm font-medium tabular-nums" aria-label={`${subdivisionNotation(pulse, 'quarter').label} equals ${bpm}`}>
        <SubdivisionIcon pulse={pulse} subdivision="quarter" className="w-5 h-7" /> = {bpm}
      </span>
      <button type="button" aria-label="Decrease tempo" onClick={() => changeTempo(bpm - 1)} className="w-8 h-8 rounded-lg hover:bg-slate-200 text-lg cursor-pointer">−</button>
      <button type="button" aria-label="Increase tempo" onClick={() => changeTempo(bpm + 1)} className="w-8 h-8 rounded-lg hover:bg-slate-200 text-lg cursor-pointer">+</button>
    </div>
    <button type="button" role="switch" aria-label="Metronome" aria-checked={!props.muted}
      onClick={() => props.onMutedChange(!props.muted)} title={props.muted ? 'Turn metronome on' : 'Mute metronome'}
      className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer ${props.muted ? 'bg-slate-300' : 'bg-[#0071e3]'}`}>
      <span className={`bg-white w-4 h-4 rounded-full shadow-xs transition-transform ${props.muted ? 'translate-x-0' : 'translate-x-4'}`} />
    </button>
    <div role="group" aria-label="Metronome subdivision" className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/80">
      {choices.map(choice => {
        const notation = subdivisionNotation(pulse, choice);
        return <button key={choice} type="button" aria-label={notation.label} title={notation.label}
          aria-pressed={props.subdivision === choice} onClick={() => props.onSubdivisionChange(choice)}
          className={`h-9 w-11 flex items-center justify-center rounded-lg cursor-pointer ${props.subdivision === choice ? 'bg-[#0071e3] text-white' : 'text-slate-700 hover:bg-slate-200/60'}`}>
          <SubdivisionIcon pulse={pulse} subdivision={choice} className={notation.count === 1 ? 'w-5 h-8' : 'w-10 h-8'} />
        </button>;
      })}
    </div>
    <button type="button" aria-label="Metronome settings" title="Metronome settings" aria-expanded={open}
      onClick={() => setOpen(value => !value)} className="w-8 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
      <SlidersHorizontal className="w-4 h-4" />
    </button>
    {open && <section aria-label="Metronome settings" className="absolute top-full right-0 mt-3 z-40 w-72 p-5 rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between mb-4"><h2 className="text-base font-semibold">Metronome</h2><span className="text-sm text-slate-500">{props.numerator}/{props.denominator}</span></div>
      <label className="block text-sm text-slate-600">Tempo
        <input type="range" aria-label="Metronome tempo" min={min} max={max} step={1} value={bpm}
          onChange={event => changeTempo(Number(event.target.value))} className="block w-full mt-3 accent-[#0071e3]" />
      </label>
      <div className="flex items-center justify-center gap-4 py-5" aria-label={`${count} beats per bar`}>
        {Array.from({ length: count }, (_, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${props.activeBeat === i + 1 ? 'bg-[#0071e3] ring-4 ring-blue-50' : 'bg-slate-200'}`} />)}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={props.countIn} onChange={event => props.onCountInChange(event.target.checked)} className="accent-[#0071e3] w-4 h-4" />
        One-bar count-in
      </label>
    </section>}
  </div>;
}
