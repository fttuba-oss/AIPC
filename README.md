# AIPC teacher and student workspaces

The application now has separate teacher (`/teacher.html`, also `/`) and student (`/student.html`) entry points. Start the integrated development app with `npm ci` then `npm run dev` (port 5174). Login hosts can use `mountTeacherApp` and `mountStudentApp` from `src/apps/mount.tsx`; the standalone pages use explicit local demo sessions until authentication is connected.

| Developer | Owned modules | Independent workflow |
| --- | --- | --- |
| A | Shared score viewer/following and teacher score files manager, under `src/modules/score/` | `npm run dev:score`, `/dev-score.html` on port 5180 |
| B | Teacher practice dispatcher/progress dashboard and student plan manager, under `src/modules/practice/` | `npm run dev:practice`, `/dev-practice.html` on port 5181 |

Read [developer boundaries, login integration, and migration notes](docs/DEVELOPER_BOUNDARIES.md) for the directory map, stable contracts, backend integration and ownership rules. Run `npm test`, `npm run build`, and `npm run test:browser` for validation. Node 24 is tested; Vite requires Node 20.19+ or 22.12+.

Teacher assignments persist locally; students can mark them done/not done and teacher progress refreshes every three seconds. Both roles use exactly the same score viewer implementation. The independent workbenches use in-memory adapters so neither developer needs the other's feature code or backend running. Shared contracts and integration files still require coordinated changes.

The old workflows remain under `src/legacy/` for staged migration. The historical overview below describes those workflows; it is not the current module map. Static hosting alone does not provide the development APIs, and demo sessions are not production authentication.

---

# 🎺 AIPC Teacher Portal & Student Practice Companion

An AI-powered music pedagogy and practice intelligence platform. AIPC bridges the gap between music teachers and student practice by combining **MusicXML score intelligence**, **real-time acoustic pitch detection**, **automated practice plan generation**, and **interactive student companion tools**.

---

## 🌟 Key Features

### 1. 🎼 Teacher Portal & Score Intelligence
- **MusicXML & Compressed MXL Support**: Upload standard `.musicxml` or compressed `.mxl` files with automatic XML extraction.
- **Automated Score Chunking & Sectioning**: Analyzes musical pieces into logical sections, rehearsal chunks, and phrase structures.
- **Intelligent Challenge Detection**: Detects technical hurdles such as high-register leaps, rapid articulation/tonguing passages, complex syncopations, and breath stamina zones based on instrument profiles.
- **Practice Plan Builder**: Assign customized goals, target tempos, repetition targets, and pedagogical notes directly to specific measures.

### 2. 🎧 Student Practice View (Interactive Companion)
- **Interactive Sheet Music Rendering**: Powered by OpenSheetMusicDisplay (OSMD) with measure highlighting and zoom controls.
- **Real-Time Acoustic Input & Pitch Detection**: Uses the browser's Web Audio API and autocorrelation to track live instrumental sound and pitch in real-time.
- **Synchronized Audio & Metronome**: Tone.js-backed synthesized reference playback and adjustable metronome.
- **Instrument Mascot Companion**: Animated interactive mascot (e.g., *Toby the Trumpet*) providing engaging real-time encouragement, feedback, and practice tips.
- **Session Audio Recording**: Records practice takes with synchronized timestamps for performance review.

### 3. 📊 Student Submissions Hub & Review Panel
- **Telemetry & Practice Analytics**: Tracks tempo stability, pitch accuracy, practice time, and goal completion rates.
- **Teacher Feedback Workflows**: Listen to student audio recordings, review flagged measures, and send structured constructive feedback.

---

## 🎵 Included Demo Pieces
Pre-loaded with sample repertoire to test various instrument difficulties:
- **Neruda**: *Trumpet Concerto in E-flat* (Virtuosic articulation & register leaps)
- **Galante**: *Sailing with Whales (Trumpet 1)* (Ostinato rhythms & expressive phrasing)
- **Beethoven**: *Ode to Joy* (Foundational melody, rhythm, and tone)
- **Yoko Takahashi**: *A Cruel Angel's Thesis* (Syncopated modern brass ensemble)

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Sheet Music Rendering**: [OpenSheetMusicDisplay (OSMD)](https://opensheetmusicdisplay.org/)
- **Audio Engine & Synthesis**: [Tone.js](https://tonejs.github.io/) & Web Audio API
- **Archive Extraction**: [JSZip](https://stuk.github.io/jszip/) (for `.mxl` support)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- A modern browser (Chrome, Edge, Firefox, Safari) with **microphone access enabled** for student practice pitch detection.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/fttuba-oss/AIPC-teacher-portal.git
   cd AIPC-teacher-portal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

## 📁 Project Structure

```text
AIPC-teacher-portal/
├── public/                     # Demo MusicXML & MXL score files
├── src/
│   ├── components/             # UI Components
│   │   ├── AddGoalModal.tsx          # Modal to create practice objectives
│   │   ├── InstrumentMascot.tsx      # Animated practice buddy mascot
│   │   ├── PracticePlanSummary.tsx   # Teacher practice plan overview
│   │   ├── ScoreViewer.tsx           # Teacher OSMD score viewer
│   │   ├── StudentChatCompanion.tsx  # Interactive AI practice guide
│   │   ├── StudentPracticeView.tsx   # Full student practice dashboard
│   │   ├── StudentScoreViewer.tsx    # Student OSMD sheet music viewer
│   │   ├── StudentSubmissionsHub.tsx # Review hub for student recordings
│   │   └── TeacherReviewPanel.tsx    # Section & difficulty editor
│   ├── types/
│   │   └── portal.ts           # Core TypeScript data models & schemas
│   ├── utils/
│   │   ├── instrumentProfiles.ts     # Acoustic ranges & instrument constraints
│   │   ├── scoreAnalyzer.ts          # Section chunking & challenge detection
│   │   ├── scoreParser.ts            # MusicXML / MXL parsing & unzipping
│   │   ├── scorePlaybackParser.ts    # Notes & measure playback scheduling
│   │   ├── studentAcousticInput.ts   # Web Audio pitch detection & FFT
│   │   ├── studentAudioEngine.ts     # Tone.js reference synthesizer
│   │   └── studentRecordingManager.ts# Student microphone recording & takes
│   ├── App.tsx                 # Primary app view switcher & state
│   ├── index.css               # Global styles & Tailwind entry
│   └── main.tsx                # React root mount
├── package.json
└── vite.config.ts
```

---

## 📜 Available Scripts

- `npm run dev` — Starts the local Vite development server.
- `npm run build` — Type checks and builds the production bundle in `dist/`.
- `npm run preview` — Locally previews the production build.
- `npm run lint` — Runs fast code linter with Oxlint.

---

## 🎙️ Note on Audio Permissions

The **Student Practice Companion** requires microphone access for real-time acoustic pitch and sound analysis. When prompted by your browser, please click **Allow** for microphone access. All audio processing runs locally in your browser via the Web Audio API — no raw microphone audio is sent to external servers.

---

## 📄 License

This project is licensed under the MIT License - see the repository details for more information.
