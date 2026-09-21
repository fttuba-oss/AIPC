import { StudentStrategyLanguage, StudentMessageContext } from './types';

/**
 * Controlled student-language configuration for each executable strategy
 * registered in RhythmStrategyRegistry.
 * 
 * Rules:
 * - 1 to 2 short sentences.
 * - Tells the student what to do next.
 * - Grounded in the existing strategy registry and implementation.
 * - Zero system-facing terms (no "scaffold", "temporal support", "Level 5", "capacity id", etc.).
 */

function formatBars(range?: [number, number]): string {
  if (!range) return 'this section';
  return `bars ${range[0]}–${range[1]}`;
}

export const STUDENT_STRATEGY_LANGUAGE: Record<string, StudentStrategyLanguage> = {
  // 1. Reference Audio / Listen-Echo (R18)
  R18: {
    strategyId: 'R18',
    introduction: "We'll listen to the rhythm first, then echo it back.",
    instruction: ({ measureRange, tempoBpm }) =>
      `Listen to ${formatBars(measureRange)}${tempoBpm ? ` at ${tempoBpm} BPM` : ''}, then play it back.`,
    afterDemo: "That's the rhythm. Have a go.",
    success: "That was accurate. Try it once more.",
    retry: "Listen once more, then try echoing the rhythm again.",
    supportReduced: "Good. Now try playing without hearing the guide first.",
    supportRestored: "Let's listen to the example again and echo it back.",
    independentAttempt: "Now play the original passage once on your own.",
    completed: "Great work. You played the rhythm accurately without the guide.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "This helps build a clear picture of the rhythm before playing.",
    immediateStep: "Listen to the guide, then echo the rhythm back.",
  },

  // 2. Tempo Ladder Calibration (R22)
  R22: {
    strategyId: 'R22',
    introduction: "We'll start at a steady tempo and build up gradually.",
    instruction: ({ measureRange, tempoBpm }) =>
      `Play ${formatBars(measureRange)} steadily${tempoBpm ? ` at ${tempoBpm} BPM` : ''}.`,
    afterDemo: "That's the rhythm at this speed. Now try it.",
    success: "That was accurate. Play it accurately twice, then we'll make it a little faster.",
    retry: "Keep it relaxed and steady at this tempo.",
    supportReduced: ({ tempoBpm }) =>
      tempoBpm ? `Good. Let's try it at ${tempoBpm} BPM.` : "Good. Let's try it a little faster.",
    supportRestored: "Let's step back to a comfortable tempo and build back up.",
    independentAttempt: "Now try it once at target tempo on your own.",
    completed: "You've reached your target tempo with steady timing.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "This builds speed step by step while keeping your rhythm clean.",
    immediateStep: "Play the passage steadily at your current tempo.",
  },

  // 3. Explicit Subdivision (R07)
  R07: {
    strategyId: 'R07',
    introduction: "Listen to the smaller beats and keep each note even.",
    instruction: ({ measureRange }) =>
      `Match your notes to the smaller beat clicks in ${formatBars(measureRange)}.`,
    afterDemo: "That's the rhythm with the smaller beats. Now try it.",
    success: "That was accurate. Play it accurately twice, then we'll make it a little harder.",
    retry: "Let's try that again with the smaller clicks.",
    supportReduced: "Good. Let's try it with fewer clicks.",
    supportRestored: "Let's bring the smaller clicks back and try again.",
    independentAttempt: "Now try it once on your own with just the main beat.",
    completed: "You've played the rhythm evenly with steady timing.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "The extra clicks help keep short notes evenly spaced.",
    immediateStep: "Follow the smaller clicks and keep each note even.",
  },

  // 4. Full Metronome Synchronisation (R10)
  R10: {
    strategyId: 'R10',
    introduction: "Match each note right on the beat clicks.",
    instruction: "Play along so your notes land exactly with each click.",
    afterDemo: "Hear how the notes match the clicks. Now try it.",
    success: "That was accurate. Try it once more.",
    retry: "Focus on landing right on top of each click.",
    supportReduced: "Good. Let's try it with a softer click.",
    supportRestored: "Let's bring the clear click back and lock in the beat.",
    independentAttempt: "Now play the passage once on your own.",
    completed: "Your notes are locked right with the beat.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "This helps lock your playing right in time with the pulse.",
    immediateStep: "Align each note attack directly with the click.",
  },

  // 5. Sparse Metronome (R11)
  R11: {
    strategyId: 'R11',
    introduction: "Keep the pulse steady between clicks.",
    instruction: "Keep your own time going when the clicks space out.",
    afterDemo: "Listen to the space between clicks. Now play along.",
    success: "Steady pulse. Try it once more.",
    retry: "Keep counting the missing beats in your head.",
    supportReduced: "Good. Let's try it with fewer clicks.",
    supportRestored: "Let's bring more clicks back to check the tempo.",
    independentAttempt: "Now play without clicks and keep the tempo steady.",
    completed: "You held a steady tempo on your own.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "This helps you keep steady time without needing a click on every beat.",
    immediateStep: "Feel the beat continuing evenly even when the clicks are spaced out.",
  },

  // 6. Gap-Click Practice (R12)
  R12: {
    strategyId: 'R12',
    introduction: "Keep playing steadily through the silent bars.",
    instruction: "Stay in tempo during the silence so you match the click when it returns.",
    afterDemo: "Notice how the pulse keeps going during the silence. Have a go.",
    success: "Accurate re-entry. Keep that steady pulse going.",
    retry: "Keep counting steadily inside when the clicks go silent.",
    supportReduced: "Good. Let's try a longer silent section.",
    supportRestored: "Let's use a shorter silence to keep the pulse clear.",
    independentAttempt: "Now play the full passage without the clicks.",
    completed: "Your internal pulse stayed steady through the silence.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "This trains you to hold your tempo when the accompaniment rests.",
    immediateStep: "Play with the click and keep your internal count steady during silent bars.",
  },

  // 7. Synchronisation-Continuation (R13)
  R13: {
    strategyId: 'R13',
    introduction: "Start with the clicks, then keep the exact same speed going on your own.",
    instruction: "Lock into the count-in, then maintain that steady speed after the clicks stop.",
    afterDemo: "Listen to the start tempo. Now take it over.",
    success: "Tempo held steady. Let's do that once more.",
    retry: "Keep the same pace going without speeding up or slowing down.",
    supportReduced: "Good. Let's try continuing for longer.",
    supportRestored: "Let's use a few more pacing clicks to lock the tempo.",
    independentAttempt: "Now play through the phrase at your established tempo.",
    completed: "You kept a steady tempo from start to finish.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "This checks that you can keep a tempo steady without relying on a metronome.",
    immediateStep: "Catch the tempo during the count-in and keep playing at that exact pace.",
  },

  // 8. Ghost Beat / X-Ray Rhythm (R20)
  R20: {
    strategyId: 'R20',
    introduction: "Feel the hidden beats under the tied notes and rests.",
    instruction: "Listen for the quiet tap under the tie so you know exactly when the next note starts.",
    afterDemo: "Hear the quiet guide notes under the ties. Now try playing.",
    success: "Clean timing off the tie. Try it once more.",
    retry: "Feel the silent beat land before you play the offbeat note.",
    supportReduced: "Good. Let's make the guide beats quieter.",
    supportRestored: "Let's bring the guide beats back under the ties.",
    independentAttempt: "Now play the passage once without the guide.",
    completed: "You played the syncopations and ties with confident timing.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "Tied notes can hide the beat. Hearing the pulse underneath keeps the timing clear.",
    immediateStep: "Listen for the ghost beat under the tie to keep your place in the measure.",
  },

  // 9. Single-Pitch Reduction (R03)
  R03: {
    strategyId: 'R03',
    introduction: "Let's play the rhythm on just one note first.",
    instruction: ({ measureRange }) =>
      `Play the rhythm of ${formatBars(measureRange)} on one comfortable note.`,
    afterDemo: "That's the rhythm on a single note. Have a go.",
    success: "Rhythm is solid on one note. Try it once more.",
    retry: "Stay on the single note and focus purely on the timing.",
    supportReduced: "Good. Now let's try with two notes.",
    supportRestored: "Let's go back to one note to get the rhythm settled.",
    independentAttempt: "Now play the original melody with all the written notes.",
    completed: "The rhythm stayed crisp even with all the notes back in.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "Using one note lets you master the rhythm before adding difficult fingering.",
    immediateStep: "Play the written rhythm on a single easy note.",
  },

  // 10. Transition Isolation & Chunking (R16)
  R16: {
    strategyId: 'R16',
    introduction: "Let's isolate the tricky transition and loop it until it's smooth.",
    instruction: "Play just these few notes back and forth smoothly with the click.",
    afterDemo: "Hear how smooth the transition sounds. Try looping it.",
    success: "Smooth transition. Let's add one note before and after.",
    retry: "Slow down the shift and keep your fingers light and relaxed.",
    supportReduced: "Good. Let's add more notes around the transition.",
    supportRestored: "Let's shrink back to just the two transition notes.",
    independentAttempt: "Now play the full phrase through the transition.",
    completed: "The transition is now smooth and in time.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "Focusing on the exact bottleneck makes the whole phrase feel easier.",
    immediateStep: "Loop just the two transition notes with the click.",
  },

  // 11. Burst Practice (R23)
  R23: {
    strategyId: 'R23',
    introduction: "Play short, quick bursts with plenty of rest in between.",
    instruction: "Play a quick three-note burst right in tempo, then relax.",
    afterDemo: "Short and clean. Now try your burst.",
    success: "Clean burst. Let's extend it by a few notes.",
    retry: "Keep the burst short and relaxed. Do not push through tension.",
    supportReduced: "Good. Let's make the burst a little longer.",
    supportRestored: "Let's shorten the burst so it stays completely relaxed.",
    independentAttempt: "Now play the full passage without stopping.",
    completed: "You played the full passage cleanly at tempo.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "Short bursts help you play fast without getting tense or tired.",
    immediateStep: "Play a short burst of notes cleanly, then rest.",
  },

  // 12. Rhythmic Variation (R24)
  R24: {
    strategyId: 'R24',
    introduction: "Let's change the rhythm pattern to free up your fingers.",
    instruction: "Play with a dotted long-short pattern, keeping fingers light.",
    afterDemo: "Listen to the long-short pattern. Have a go.",
    success: "Fingers moving freely. Now let's try the reverse pattern.",
    retry: "Keep your hands relaxed and let the rhythm swing naturally.",
    supportReduced: "Good. Now return to even notes and feel the smoothness.",
    supportRestored: "Let's return to the practice pattern to unlock the movement.",
    independentAttempt: "Now play the written passage evenly at tempo.",
    completed: "Your notes are even, fluid, and relaxed.",
    teacherSupport: "Let's save this for you and your teacher to work on together.",
    whySelected: "Practicing in long-short patterns helps fingers move smoothly on fast notes.",
    immediateStep: "Play the notes in the long-short practice pattern.",
  },
};

const DEFAULT_STRATEGY_LANGUAGE: StudentStrategyLanguage = {
  strategyId: 'DEFAULT',
  introduction: "Let's focus on this passage together.",
  instruction: ({ measureRange, tempoBpm }) =>
    `Play ${formatBars(measureRange)}${tempoBpm ? ` at ${tempoBpm} BPM` : ''} with a steady pulse.`,
  afterDemo: "That's the rhythm. Have a go.",
  success: "That was accurate. Try it once more.",
  retry: "Let's try that again with a steady pulse.",
  supportReduced: "Good. Let's try it with fewer clicks.",
  supportRestored: "Let's bring the clicks back and try again.",
  independentAttempt: "Now play the original passage once on your own.",
  completed: "You've completed this exercise with steady timing.",
  teacherSupport: "Let's save this for you and your teacher to work on together.",
  whySelected: "This exercise helps steady your timing on this passage.",
  immediateStep: "Follow the guide and play the rhythm steadily.",
};

export function getStudentStrategyLanguage(strategyId?: string): StudentStrategyLanguage {
  if (!strategyId) return DEFAULT_STRATEGY_LANGUAGE;
  return STUDENT_STRATEGY_LANGUAGE[strategyId] || DEFAULT_STRATEGY_LANGUAGE;
}
