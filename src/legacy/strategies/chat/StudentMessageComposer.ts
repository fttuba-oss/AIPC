import {
  StudentChatEvent,
  StudentIntent,
  StudentMessageContext,
  TextOrContextFn,
  BANNED_TERMS
} from './types';
import { getStudentStrategyLanguage } from './studentStrategyLanguage';

function resolveText(target: TextOrContextFn | undefined, context: StudentMessageContext, fallback = ''): string {
  if (!target) return fallback;
  if (typeof target === 'function') {
    return target(context);
  }
  return target;
}

export class StudentMessageComposer {
  public static readonly UNRECOGNISED_REPLY =
    "I can help with this exercise, the rhythm, the tempo, or what to do next. Which one do you mean?";

  /**
   * Generates a student-facing message for a structured event.
   */
  public static compose(event: StudentChatEvent, context: StudentMessageContext): string {
    const lang = getStudentStrategyLanguage(context.strategyId);

    let message: string;

    switch (event) {
      case 'SESSION_STARTED': {
        const intro = resolveText(lang.introduction, context);
        message = `Hey! I'm Toots, your practice companion. ${intro}`;
        break;
      }

      case 'INSTRUCTION': {
        message = resolveText(lang.instruction, context);
        break;
      }

      case 'DEMO_STARTED': {
        message = "Listen once, then have a go.";
        break;
      }

      case 'DEMO_COMPLETED': {
        message = "That's the rhythm. Now try it.";
        break;
      }

      case 'READY_TO_PLAY': {
        message = "Let's play. Count in with the clicks and stay relaxed.";
        break;
      }

      case 'EXPLAIN_EXERCISE': {
        message = resolveText(lang.immediateStep || lang.instruction, context);
        break;
      }

      case 'SLOWER_TEMPO_REQUESTED': {
        if (context.canAdjustTempo && context.newTempoBpm) {
          message = `Tempo lowered to ${context.newTempoBpm} BPM. Try it at this speed.`;
        } else {
          message = "We can slow it down in Coach Mode. Open the exercise and choose a lower tempo.";
        }
        break;
      }

      case 'ATTEMPT_SUCCEEDED': {
        message = resolveText(lang.success, context, "That was accurate. Try it once more.");
        break;
      }

      case 'ATTEMPT_FAILED': {
        message = resolveText(lang.retry, context, "Let's try that again with a steady pulse.");
        break;
      }

      case 'SUPPORT_REDUCED': {
        message = resolveText(lang.supportReduced, context, "Good. Let's try it with fewer clicks.");
        break;
      }

      case 'SUPPORT_RESTORED': {
        message = resolveText(lang.supportRestored, context, "Let's bring the smaller clicks back and try again.");
        break;
      }

      case 'INDEPENDENT_RETEST': {
        message = resolveText(lang.independentAttempt, context, "Now play the original passage once on your own.");
        break;
      }

      case 'SESSION_COMPLETED': {
        message = resolveText(lang.completed, context, "You've completed this exercise with steady timing.");
        break;
      }

      case 'TEACHER_SUPPORT_NEEDED': {
        message = resolveText(lang.teacherSupport, context, "Let's save this for you and your teacher to work on together.");
        break;
      }

      case 'UNRECOGNISED_REQUEST':
      default: {
        message = this.UNRECOGNISED_REPLY;
        break;
      }
    }

    return this.sanitize(message);
  }

  /**
   * Generates a student-facing message responding to a student intention.
   */
  public static composeFromIntent(intent: StudentIntent, context: StudentMessageContext): string {
    const lang = getStudentStrategyLanguage(context.strategyId);
    let message: string;

    switch (intent) {
      case 'REPEAT_INSTRUCTION':
        message = resolveText(lang.instruction, context);
        break;

      case 'EXPLAIN_EXERCISE':
        message = resolveText(lang.immediateStep || lang.instruction, context);
        break;

      case 'PLAY_EXAMPLE':
        message = "Listen once, then have a go.";
        break;

      case 'SLOWER_TEMPO':
        message = this.compose('SLOWER_TEMPO_REQUESTED', context);
        break;

      case 'WHY_SELECTED':
        message = resolveText(lang.whySelected, context);
        break;

      case 'REPORT_RUSHING':
        message = "If you find yourself rushing, keep your fingers relaxed and listen for the click before each note.";
        break;

      case 'ASK_TIES_SYNCOPATION':
        message = "Across tied notes, count the silent beats in your head so you know when the next note starts.";
        break;

      case 'REPORT_STUCK':
        message = "Let's take it one step at a time. Try listening to the example or taking it a little slower.";
        break;

      case 'READY_TO_PLAY':
        message = "Let's play. Count in with the clicks and stay relaxed.";
        break;

      case 'ASK_MORE_HELP':
        message = resolveText(lang.retry, context);
        break;

      case 'TRY_INDEPENDENTLY':
        message = resolveText(lang.independentAttempt, context);
        break;

      case 'REQUEST_TEACHER_HELP':
        message = "Let's save this for you and your teacher to work on together.";
        break;

      case 'UNRECOGNISED':
      default:
        message = this.UNRECOGNISED_REPLY;
        break;
    }

    return this.sanitize(message);
  }

  /**
   * Safety sanitizer to ensure no internal terms leak into student messages.
   */
  public static sanitize(message: string): string {
    let clean = message;
    for (const term of BANNED_TERMS) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(clean)) {
        clean = clean.replace(regex, '');
      }
    }
    // Clean up any double spaces or orphan punctuation caused by stripping
    clean = clean.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
    return clean;
  }
}
