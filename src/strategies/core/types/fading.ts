/**
 * AIPC Assistance Scale (Levels 0 to 5)
 * Level 0: Maximum external scaffolding (most assistance - subdivision grid, reference audio model, baseline tempo)
 * Level 1: High scaffolding
 * Level 2: Moderate scaffolding
 * Level 3: Low scaffolding
 * Level 4: Minimal scaffolding
 * Level 5: Unsupported original context retest (least assistance - target tempo, original notation, exit gate)
 */

export type AssistanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface BaseAssistanceConfig {
  level: AssistanceLevel;
  temporalSupport: 'Maximum' | 'High' | 'Moderate' | 'Low' | 'Minimal' | 'None';
  description: string;
  learnerPrompt: string;
}

export type FadingAction = 
  | 'advance'           // Student demonstrated control (2 consecutive successes) -> decrease support (move toward Level 5)
  | 'progress'          // Synonymous with advance for strategy-specific controller progression
  | 'regress'           // Student failed 2 consecutive attempts -> increase support (move toward Level 0)
  | 'repeat'            // Keep practicing at current level
  | 'continue'          // Continue practicing current scaffold state
  | 'retest'            // Ready for Level 5 unsupported retest
  | 'resolved'          // Successfully passed Level 5 retest
  | 'switch_strategy'   // Switch to a complementary or chained strategy
  | 'refer_to_teacher'; // Plateaued, repeated failure, or inconclusive evidence

export interface FadingEvaluationResult {
  action: FadingAction;
  previousLevel: AssistanceLevel;
  newLevel: AssistanceLevel;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  message: string;
  isRetest: boolean;
}
