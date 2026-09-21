import { StudentIntent } from './types';

/**
 * Controlled Student Intent Handler
 * 
 * Maps student messages strictly to functions and pedagogical knowledge
 * already present in the repository.
 * 
 * Unrecognised queries are bounded and not answered with fabricated claims.
 */
export class StudentIntentHandler {
  public static detectIntent(input: string): StudentIntent {
    const text = input.trim().toLowerCase();
    if (!text) return 'UNRECOGNISED';

    // 1. Repeat the current instruction
    if (
      /^(repeat|say (that )?again|what did you say|tell me again|again please|repeat instruction)\b/.test(text) ||
      text === 'repeat' ||
      text === 'again' ||
      text === 'say again'
    ) {
      return 'REPEAT_INSTRUCTION';
    }

    // 2. Play the example / Play it for me
    if (
      /play (it|example|demo|for me|model)|listen to (it|the rhythm|example)|can you play|let me hear|hear (it|the rhythm|demo)|play the rhythm/.test(text)
    ) {
      return 'PLAY_EXAMPLE';
    }

    // 3. Report rushing or playing too fast (checked before general tempo/speed)
    if (
      /rush(ing)?|speeding up|i keep rushing|am i rushing|ahead of the beat/.test(text)
    ) {
      return 'REPORT_RUSHING';
    }

    // 4. Request a slower tempo
    if (
      /slow(er)?|too fast|lower tempo|reduce tempo|lower bpm|decrease speed|slow down/.test(text) ||
      /can we (slow down|go slower|reduce the speed)/.test(text)
    ) {
      return 'SLOWER_TEMPO';
    }

    // 5. Ask about ties or syncopation
    if (
      /\b(tie|tied|ties|syncopat(ed|ion|ions)|offbeat|offbeats|ghost beat)\b/.test(text)
    ) {
      return 'ASK_TIES_SYNCOPATION';
    }

    // 6. Ask why the current exercise was selected
    if (
      /why (this|the|is|was|are|we doing)|why choose|why selected|what is the purpose|why practice this/.test(text)
    ) {
      return 'WHY_SELECTED';
    }

    // 7. Report being stuck
    if (
      /\b(stuck|struggling|too hard|difficult)\b|i can'?t (do this|play this|get this)/.test(text)
    ) {
      return 'REPORT_STUCK';
    }

    // 8. Say they are ready to play
    if (
      /ready( to play)?|let'?s play|start playing|i'?m ready|im ready|start now/.test(text)
    ) {
      return 'READY_TO_PLAY';
    }

    // 9. Ask to try independently
    if (
      /(try|play) (on my own|independently|alone|by myself|without (help|clicks|guide|metronome))/.test(text) ||
      /can i try (alone|on my own|without help)/.test(text)
    ) {
      return 'TRY_INDEPENDENTLY';
    }

    // 10. Request teacher help
    if (
      /\b(teacher|lesson|ask teacher|need teacher|save for teacher|tell my teacher|teacher help)\b/.test(text)
    ) {
      return 'REQUEST_TEACHER_HELP';
    }

    // 11. Ask for more help / hint
    if (
      /\b(hint|more help|give me a hint|another hint)\b/.test(text) ||
      /^help(\b|!|\?)/.test(text) ||
      text === 'help'
    ) {
      return 'ASK_MORE_HELP';
    }

    // 12. Explain what to do / explain exercise
    if (
      /what (do|should) i do|how (do|to)|explain|what next|what to do|instructions|what are the steps/.test(text)
    ) {
      return 'EXPLAIN_EXERCISE';
    }

    // Everything else is unrecognised
    return 'UNRECOGNISED';
  }

  public static resolveActionKey(actionKey: string): StudentIntent {
    switch (actionKey) {
      case 'listen_demo':
        return 'PLAY_EXAMPLE';
      case 'ready_to_play':
        return 'READY_TO_PLAY';
      case 'what_to_do':
        return 'EXPLAIN_EXERCISE';
      case 'slower_tempo':
        return 'SLOWER_TEMPO';
      case 'give_hint':
        return 'ASK_MORE_HELP';
      default:
        return 'UNRECOGNISED';
    }
  }

  public static getActionKeyStudentText(actionKey: string): string {
    switch (actionKey) {
      case 'listen_demo':
        return 'Play it for me, please!';
      case 'ready_to_play':
        return "I'm ready to play!";
      case 'what_to_do':
        return 'What should I do right now?';
      case 'slower_tempo':
        return 'Can we try a slower tempo?';
      case 'give_hint':
        return 'Can you give me a hint?';
      default:
        return actionKey;
    }
  }
}
