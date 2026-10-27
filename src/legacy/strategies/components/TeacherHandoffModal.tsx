import React, { useState } from 'react';
import { 
  FileText, CheckCircle, AlertTriangle, ArrowRight, 
  Copy, Check, X, ShieldAlert, Sparkles, BookOpen 
} from 'lucide-react';
import { TeacherHandoffRecord } from '../classifications/rhythm/types/diagnosticProfile';

interface TeacherHandoffModalProps {
  record: TeacherHandoffRecord;
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherHandoffModal: React.FC<TeacherHandoffModalProps> = ({
  record,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = [
      `AIPC RHYTHM DIAGNOSTIC HANDOFF REPORT`,
      `====================================`,
      `Date/Time: ${new Date(record.createdAt).toLocaleString()}`,
      `Student: ${record.studentId} | Passage: ${record.passageId}`,
      `Problem: ${record.problemName}`,
      `\nREASON FOR REFERRAL:\n${record.reasonForReferral}`,
      `\nBASELINE SUMMARY:\n${record.baselineSummary}`,
      `\nINTERVENTIONS ATTEMPTED:`,
      ...record.interventionsAttempted.map(i => ` - [${i.interventionId}] ${i.interventionName} (${i.attempts} attempts): ${i.response}`),
      `\nLEADING HYPOTHESES:`,
      ...record.leadingHypotheses.map(h => ` - ${h.label} (${h.capacityId}): score ${h.evidenceScore}/5.0 [${h.status.toUpperCase()}] confidence: ${h.confidence}`),
      `\nSUGGESTED TEACHER OBSERVATIONS:`,
      ...record.suggestedTeacherCheck.map(a => ` - ${a}`),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-3xl border border-amber-500/40 shadow-2xl flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">
                  Teacher Pedagogical Handoff
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Automated Paused
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AIPC Autonomous Diagnostic & Intervention Handoff Report &middot; {record.problemName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">

          {/* Alert Callout */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Practice Session Protection Gate Triggered
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {record.reasonForReferral}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {record.baselineSummary}
              </p>
            </div>
          </div>

          {/* Interventions Attempted */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Interventions Attempted</span>
            </div>
            <div className="space-y-2">
              {record.interventionsAttempted.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-cyan-400 font-mono">
                        [{item.interventionId}]
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        {item.attempts} focused attempts
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
                        {item.response.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Hypotheses Snapshot */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Leading Diagnostic Hypotheses</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {record.leadingHypotheses.map(h => {
                const isLeading = h.status === 'leading';
                const percent = Math.min(100, Math.round((h.evidenceScore / 5.0) * 100));
                return (
                  <div key={h.capacityId} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">
                        {h.label} <span className="text-slate-500 font-mono">({h.capacityId})</span>
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isLeading 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {h.status.toUpperCase()} ({h.evidenceScore.toFixed(1)}/5.0)
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300 bg-amber-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suggested Teacher Observations & Actions */}
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span>Suggested In-Person Teacher Checkpoints</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
              {record.suggestedTeacherCheck.map((act, i) => (
                <li key={i} className="leading-relaxed">{act}</li>
              ))}
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/95 sticky bottom-0">
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-slate-700 active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Handoff Report'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-purple-600/30 active:scale-95"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Acknowledge & Close</span>
          </button>
        </div>

      </div>
    </div>
  );
};
