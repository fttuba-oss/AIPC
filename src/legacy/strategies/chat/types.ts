/**
 * Student Chatbot Types
 * Pure student-facing event and context definitions.
 * Separates pedagogical logic from message wording.
 */

export type StudentChatEvent =
  | 'SESSION_STARTED'
  | 'INSTRUCTION'
  | 'DEMO_STARTED'
  | 'DEMO_COMPLETED'
  | 'READY_TO_PLAY'
  | 'EXPLAIN_EXERCISE'
  | 'SLOWER_TEMPO_REQUESTED'
  | 'ATTEMPT_SUCCEEDED'
  | 'ATTEMPT_FAILED'
  | 'SUPPORT_REDUCED'
  | 'SUPPORT_RESTORED'
  | 'INDEPENDENT_RETEST'
  | 'SESSION_COMPLETED'
  | 'TEACHER_SUPPORT_NEEDED'
  | 'UNRECOGNISED_REQUEST';

export type StudentIntent =
  | 'REPEAT_INSTRUCTION'
  | 'EXPLAIN_EXERCISE'
  | 'PLAY_EXAMPLE'
  | 'SLOWER_TEMPO'
  | 'WHY_SELECTED'
  | 'REPORT_RUSHING'
  | 'ASK_TIES_SYNCOPATION'
  | 'REPORT_STUCK'
  | 'READY_TO_PLAY'
  | 'ASK_MORE_HELP'
  | 'TRY_INDEPENDENTLY'
  | 'REQUEST_TEACHER_HELP'
  | 'UNRECOGNISED';

export interface StudentMessageContext {
  strategyId: string;
  strategyName?: string;
  measureRange?: [number, number];
  tempoBpm?: number;
  learnerPrompt?: string;
  procedureSteps?: string[];
  progressAction?: string;
  regressAction?: string;
  currentLevel?: number;
  requiredSuccesses?: number;
  consecutiveSuccesses?: number;
  attemptPassed?: boolean;
  canAdjustTempo?: boolean;
  newTempoBpm?: number;
  pieceTitle?: string;
  userQuestion?: string;
}

export type TextOrContextFn = string | ((ctx: StudentMessageContext) => string);

export interface StudentStrategyLanguage {
  strategyId: string;
  introduction: TextOrContextFn;
  instruction: TextOrContextFn;
  afterDemo: TextOrContextFn;
  success: TextOrContextFn;
  retry: TextOrContextFn;
  supportReduced: TextOrContextFn;
  supportRestored: TextOrContextFn;
  independentAttempt: TextOrContextFn;
  completed: TextOrContextFn;
  teacherSupport: TextOrContextFn;
  whySelected: TextOrContextFn;
  immediateStep?: TextOrContextFn;
}

export const BANNED_TERMS = [
  'aural demo',
  'scaffold',
  'temporal support',
  'autonomous rhythm mastery',
  'referral packet',
  'capacity id',
  'level 5',
  'level 4',
  'level 3',
  'level 2',
  'level 1',
  'level 0',
  'subdivision lattice',
  'motor pathways',
  'rc01',
  'rc02',
  'rc03',
  'rc04',
  'rc05',
  'rc06',
  'rc07',
  'rc08',
  'rc09',
  'r03',
  'r07',
  'r10',
  'r11',
  'r12',
  'r13',
  'r16',
  'r18',
  'r20',
  'r22',
  'r23',
  'r24'
];
