/**
 * Student Recording & Practice Session Manager
 * Organizes recordings into:
 * Practice Session -> Section Practicing -> Takes with Time Taken
 * Persists sessions in local storage for teacher review.
 */

export interface RecordedTake {
  id: string;
  takeNumber: number;
  timestamp: string;
  mode: 'audio' | 'video';
  blobUrl: string;
  blobSize: number;
  mimeType: string;
  durationSeconds: number;
  tempoUsed: number;
  selfRating?: number; // 1-5 stars
}

export interface SectionPracticeLog {
  sectionId: string;
  sectionName: string;
  measureRange: [number, number];
  timeSpentSeconds: number;
  takes: RecordedTake[];
  submittedAt?: string;
  lastPracticedAt: string;
}

export interface PracticeSession {
  sessionId: string;
  studentId: string;
  studentName: string;
  title: string;
  pieceName: string;
  instrumentName: string;
  startedAt: string;
  totalPracticeSeconds: number;
  sections: Record<string, SectionPracticeLog>;
  isSubmitted: boolean;
}

const STORAGE_KEY = 'aipc_practice_sessions';
const ACTIVE_SESSION_ID_KEY = 'aipc_active_session_id';

// In-memory cache of created blob URLs
export const activeBlobRegistry = new Map<string, Blob>();

// Default mock student roster
export const MOCK_STUDENTS = [
  { id: 'stud_alex', name: 'Alex Morgan', instrument: 'Trumpet 1', grade: 'Grade 8' },
  { id: 'stud_chloe', name: 'Chloe Tan', instrument: 'Trumpet 1', grade: 'Grade 7' },
  { id: 'stud_liam', name: 'Liam Wong', instrument: 'Flute 1', grade: 'Grade 8' },
];

/**
 * Loads all saved practice sessions
 */
export function getAllPracticeSessions(): PracticeSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load practice sessions', e);
  }

  // Initial seed data with multiple students
  const seedSessions: PracticeSession[] = [
    {
      sessionId: 'session_seed_alex_1',
      studentId: 'stud_alex',
      studentName: 'Alex Morgan',
      title: 'Practice Session - Sep 5, 2026 (04:15 PM)',
      pieceName: 'Galante: Sailing with Whales',
      instrumentName: 'Trumpet 1',
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      totalPracticeSeconds: 380,
      isSubmitted: true,
      sections: {
        'sec_1': {
          sectionId: 'sec_1',
          sectionName: 'Section 1 (Bars 1–5)',
          measureRange: [1, 5],
          timeSpentSeconds: 380,
          submittedAt: new Date(Date.now() - 86400000).toISOString(),
          lastPracticedAt: new Date(Date.now() - 86400000).toISOString(),
          takes: [
            {
              id: 'take_alex_1',
              takeNumber: 1,
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              mode: 'video',
              blobUrl: '',
              blobSize: 240000,
              mimeType: 'video/webm',
              durationSeconds: 28,
              tempoUsed: 78,
            }
          ]
        }
      }
    },
    {
      sessionId: 'session_seed_chloe_1',
      studentId: 'stud_chloe',
      studentName: 'Chloe Tan',
      title: 'Practice Session - Sep 4, 2026 (06:30 PM)',
      pieceName: 'Neruda: Trumpet Concerto',
      instrumentName: 'Trumpet 1',
      startedAt: new Date(Date.now() - 172800000).toISOString(),
      totalPracticeSeconds: 510,
      isSubmitted: true,
      sections: {
        'sec_2': {
          sectionId: 'sec_2',
          sectionName: 'Section 2 (Bars 6–10)',
          measureRange: [6, 10],
          timeSpentSeconds: 510,
          submittedAt: new Date(Date.now() - 172800000).toISOString(),
          lastPracticedAt: new Date(Date.now() - 172800000).toISOString(),
          takes: [
            {
              id: 'take_chloe_1',
              takeNumber: 1,
              timestamp: new Date(Date.now() - 172800000).toISOString(),
              mode: 'audio',
              blobUrl: '',
              blobSize: 180000,
              mimeType: 'audio/webm',
              durationSeconds: 34,
              tempoUsed: 80,
            }
          ]
        }
      }
    }
  ];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedSessions));
  } catch (e) {
    // ignore
  }

  return seedSessions;
}

/**
 * Saves all practice sessions
 */
export function saveAllPracticeSessions(sessions: PracticeSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save practice sessions', e);
  }
}

/**
 * Gets or creates the current active practice session for a piece & instrument
 */
export function getOrCreateActiveSession(pieceName: string, instrumentName: string): PracticeSession {
  const sessions = getAllPracticeSessions();
  const activeId = localStorage.getItem(ACTIVE_SESSION_ID_KEY);

  if (activeId) {
    const existing = sessions.find(s => s.sessionId === activeId && !s.isSubmitted);
    if (existing) return existing;
  }

  // Create new session
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const newSession: PracticeSession = {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    studentId: 'stud_alex',
    studentName: 'Alex Morgan',
    title: `Practice Session - ${dateStr} (${timeStr})`,
    pieceName,
    instrumentName,
    startedAt: now.toISOString(),
    totalPracticeSeconds: 0,
    sections: {},
    isSubmitted: false,
  };

  sessions.unshift(newSession);
  saveAllPracticeSessions(sessions);
  localStorage.setItem(ACTIVE_SESSION_ID_KEY, newSession.sessionId);
  return newSession;
}

/**
 * Records practice time spent on a section
 */
export function recordSectionTime(
  sessionId: string,
  sectionId: string,
  sectionName: string,
  measureRange: [number, number],
  additionalSeconds: number
): void {
  const sessions = getAllPracticeSessions();
  const session = sessions.find(s => s.sessionId === sessionId);
  if (!session) return;

  session.totalPracticeSeconds += additionalSeconds;

  if (!session.sections[sectionId]) {
    session.sections[sectionId] = {
      sectionId,
      sectionName,
      measureRange,
      timeSpentSeconds: 0,
      takes: [],
      lastPracticedAt: new Date().toISOString(),
    };
  }

  session.sections[sectionId].timeSpentSeconds += additionalSeconds;
  session.sections[sectionId].lastPracticedAt = new Date().toISOString();

  saveAllPracticeSessions(sessions);
}

/**
 * Saves a newly recorded take into the session hierarchy
 */
export function saveRecordedTake(
  sessionId: string,
  sectionId: string,
  sectionName: string,
  measureRange: [number, number],
  takeBlob: Blob,
  mode: 'audio' | 'video',
  durationSeconds: number,
  tempoUsed: number
): RecordedTake {
  const sessions = getAllPracticeSessions();
  const session = sessions.find(s => s.sessionId === sessionId);
  if (!session) throw new Error('Session not found');

  if (!session.sections[sectionId]) {
    session.sections[sectionId] = {
      sectionId,
      sectionName,
      measureRange,
      timeSpentSeconds: 0,
      takes: [],
      lastPracticedAt: new Date().toISOString(),
    };
  }

  const sectionLog = session.sections[sectionId];
  const takeNumber = sectionLog.takes.length + 1;
  const takeId = `take_${sectionId}_${takeNumber}_${Date.now()}`;
  const blobUrl = URL.createObjectURL(takeBlob);

  activeBlobRegistry.set(takeId, takeBlob);

  const take: RecordedTake = {
    id: takeId,
    takeNumber,
    timestamp: new Date().toISOString(),
    mode,
    blobUrl,
    blobSize: takeBlob.size,
    mimeType: takeBlob.type || (mode === 'video' ? 'video/webm' : 'audio/webm'),
    durationSeconds: Math.max(1, Math.round(durationSeconds)),
    tempoUsed,
  };

  sectionLog.takes.push(take);
  sectionLog.lastPracticedAt = new Date().toISOString();

  saveAllPracticeSessions(sessions);
  return take;
}

/**
 * Submits the section / session to the teacher
 */
export function submitSectionToTeacher(sessionId: string, sectionId: string): void {
  const sessions = getAllPracticeSessions();
  const session = sessions.find(s => s.sessionId === sessionId);
  if (!session) return;

  if (session.sections[sectionId]) {
    session.sections[sectionId].submittedAt = new Date().toISOString();
  }

  // Check if at least one section is submitted
  const anySubmitted = Object.values(session.sections).some(sec => !!sec.submittedAt);
  if (anySubmitted) {
    session.isSubmitted = true;
  }

  saveAllPracticeSessions(sessions);
}

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// Browser MediaRecorder Controller
// ----------------------------------------------------------------------------

export class MediaRecordingEngine {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private startTime: number = 0;
  private isRecording: boolean = false;
  private internalTracks: MediaStreamTrack[] = [];
  private animInterval: any = null;

  async start(
    mode: 'audio' | 'video',
    previewVideoElement?: HTMLVideoElement | null,
    existingVideoStream?: MediaStream | null
  ): Promise<void> {
    this.cleanup();
    this.recordedChunks = [];
    this.startTime = Date.now();
    this.internalTracks = [];

    const videoTracks: MediaStreamTrack[] = [];
    const audioTracks: MediaStreamTrack[] = [];

    // 1. Acquire Video Tracks (if mode is video)
    if (mode === 'video') {
      // Preference A: reuse live video tracks from existing preview stream
      if (existingVideoStream) {
        const liveVideoTracks = existingVideoStream.getVideoTracks().filter(t => t.readyState === 'live');
        if (liveVideoTracks.length > 0) {
          videoTracks.push(...liveVideoTracks);
        }
      }

      // Preference B: acquire hardware webcam stream directly if needed
      if (videoTracks.length === 0 && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: { ideal: 'user' }
            }
          });
          const tracks = camStream.getVideoTracks();
          videoTracks.push(...tracks);
          this.internalTracks.push(...tracks);
        } catch (e1) {
          console.warn('Ideal video constraints failed, trying basic video: true', e1);
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const tracks = camStream.getVideoTracks();
            videoTracks.push(...tracks);
            this.internalTracks.push(...tracks);
          } catch (e2) {
            console.warn('Could not acquire real camera hardware, will fallback to synthetic video', e2);
          }
        }
      }

      // Preference C: Synthetic animated canvas stream (ensures valid, playable video file even if camera is blocked/unavailable)
      if (videoTracks.length === 0 && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          let frame = 0;
          this.animInterval = setInterval(() => {
            frame++;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 640, 480);

            // Title and Take Info
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText('AIPC Practice Take (Video)', 40, 60);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px sans-serif';
            ctx.fillText(`Frame ${frame} • Practice Take Active`, 40, 95);

            // Animated waveform bars
            for (let i = 0; i < 24; i++) {
              const h = Math.abs(Math.sin((frame * 0.15) + (i * 0.4))) * 90 + 20;
              ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#38bdf8';
              ctx.fillRect(50 + (i * 22), 320 - h, 14, h);
            }
          }, 40);

          try {
            const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(25) : (canvas as any).mozCaptureStream(25);
            const tracks = canvasStream.getVideoTracks();
            videoTracks.push(...tracks);
            this.internalTracks.push(...tracks);
          } catch (err) {
            console.warn('Canvas captureStream failed:', err);
          }
        }
      }
    }

    // 2. Acquire Audio Tracks
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        });
        const tracks = micStream.getAudioTracks();
        audioTracks.push(...tracks);
        this.internalTracks.push(...tracks);
      } catch {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const tracks = micStream.getAudioTracks();
          audioTracks.push(...tracks);
          this.internalTracks.push(...tracks);
        } catch (e) {
          console.warn('Microphone access unavailable, generating synthetic audio', e);
        }
      }
    }

    // Audio fallback: oscillator destination
    if (audioTracks.length === 0 && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          const tracks = dst.stream.getAudioTracks();
          audioTracks.push(...tracks);
          this.internalTracks.push(...tracks);
        }
      } catch (err) {
        console.warn('AudioContext destination failed:', err);
      }
    }

    // Combine tracks
    this.mediaStream = new MediaStream([...videoTracks, ...audioTracks]);

    // Handle video preview element if supplied
    if (previewVideoElement && mode === 'video' && videoTracks.length > 0) {
      if (existingVideoStream && previewVideoElement.srcObject === existingVideoStream) {
        // already playing
      } else {
        previewVideoElement.srcObject = new MediaStream(videoTracks);
      }
      previewVideoElement.play().catch(e => console.warn('Preview play warning:', e));
    }

    // Determine supported mimeType
    let mimeType = '';
    if (mode === 'video') {
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4'
      ];
      mimeType = candidates.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
    } else {
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];
      mimeType = candidates.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
    }

    try {
      this.mediaRecorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
    } catch {
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Slice chunks every 250ms
    this.isRecording = true;
  }

  async stop(): Promise<{ blob: Blob; durationSeconds: number }> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const duration = (Date.now() - this.startTime) / 1000;
        const blob = new Blob(this.recordedChunks, { type: this.recordedChunks[0]?.type || 'video/webm' });
        this.cleanup();
        resolve({ blob, durationSeconds: duration });
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = (Date.now() - this.startTime) / 1000;
        const type = this.mediaRecorder?.mimeType || this.recordedChunks[0]?.type || 'video/webm';
        const finalBlob = new Blob(this.recordedChunks, { type });
        this.cleanup();
        resolve({ blob: finalBlob, durationSeconds: duration });
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  private cleanup(): void {
    if (this.animInterval) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    }
    this.internalTracks.forEach(track => {
      try {
        track.stop();
      } catch (_) {}
    });
    this.internalTracks = [];
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.isRecording = false;
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }
}
