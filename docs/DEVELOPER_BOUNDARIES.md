# Teacher/student architecture and developer ownership

AIPC has two role shells and two independently developed domains. The shells compose modules; neither domain imports the other domain, the shells, or legacy code. `npm test` enforces this boundary.

| Entry | Modules |
| --- | --- |
| `/teacher.html` (also `/`) | Score files manager, score viewer, practice plan dispatcher, student progress dashboard |
| `/student.html` | Practice plan manager, score viewer |

Both role shells import **the same `ScoreViewer`** from `src/modules/score/index.ts`. It uses the existing OSMD rendering, playback parser, metronome, audio engine, and continuous score tracker. Teachers and students can play/follow a score, select an instrument part, seek by clicking the score, and use the metronome. The cursor follows the playback timeline; live microphone-driven alignment is not added by this refactor.

## Developer A: score domain

Own `src/modules/score/**`, `tests/score/**`, and `dev-score.html`.

- `ScoreFilesManager.tsx`: score catalog and MusicXML/MXL upload.
- `ScoreViewer.tsx`, `viewer/NotationViewer.tsx`: shared viewer, transport, notation, selection, cursor integration.
- `engine/**`: parsing, playback timing, acoustic input utilities, sample engines, and score analysis.
- `catalog.ts`: score catalog gateway and hook.
- `server.ts`: `/api/storage/scores` and `/api/storage/scores/:id/xml`; owns `storage/scores/` only.
- `dev.tsx` and `vite.config.ts`: independent workbench with an in-memory catalog, no backend required.

Run `npm run dev:score`, then use the `/dev-score.html` path on port 5180. Run `npm run test:score` and `npm run build:score`. This Vite configuration does not import the practice domain or its backend. The retained `Score Following/` prototype is also Developer A's reference material; it is not a third active app or the shared viewer implementation.

## Developer B: practice domain

Own `src/modules/practice/**`, `tests/practice/**`, and `dev-practice.html`.

- `PracticePlanDispatcher.tsx`: teacher assignment creation, recipients, measure ranges and instructions.
- `StudentProgressDashboard.tsx`: completion overview, refreshed every three seconds.
- `PracticePlanManager.tsx`: student's assigned plans and done/not-done changes.
- `gateway.ts` and `usePlans.ts`: client communication and polling.
- `repository.ts` and `server.ts`: `/api/practice/students`, `/api/practice/plans`, `/api/practice/plans/:id/status`.
- Owns `storage/practice-plans/` and roster integration (`storage/students.json`).
- `dev.tsx` and `vite.config.ts`: independent workbench showing teacher and student modules together with one in-memory practice gateway. The score viewer is replaced by a callback recorder.

Run `npm run dev:practice`, then use `/dev-practice.html` on port 5181. Run `npm run test:practice` and `npm run build:practice`. This configuration does not import the score domain or its backend. It uses a fixed `ScoreReference` fixture and does not need uploaded scores, score parsing, audio, or Developer A's work.

## Shared integration surface

`src/contracts/index.ts` contains DTOs and gateway interfaces. `src/contracts/testing.ts` provides in-memory adapters and fixed fixtures. `src/contracts/portal.ts` preserves old model types needed by existing parsing utilities and archived components.

`src/apps/**`, HTML role entries, `src/server/http.ts`, `vite.config.ts`, package manifests, `src/shared/styles.css` and `src/index.css`, and integration tests are integration-owned. Agree on changes to these files and contracts before changing them. Neither developer should need to edit these files for work inside an existing module. Additive internal changes can proceed concurrently in their respective directories. A contract/schema change still requires coordination; no integrated application can eliminate that dependency.

The practice domain receives only score metadata (`ScoreReference`) and an `onOpenScore(ScoreSelection)` callback. It never imports notation, parsing, or audio code. The score domain never imports practice assignment or completion code. The shell loads catalog metadata and supplies it to the dispatcher. If the score backend is unavailable, the integrated catalog cannot list new uploads, but the practice workbench remains fully usable with its contract fixture.

Do not create parallel teacher and student viewer implementations. Add viewer behavior once inside the score domain. Do not use shared global events or mutate another domain's state; cross-domain navigation goes through shell callbacks.

## Login integration

The HTML pages are separate UI entry points, not authentication controls. Without an injected session, the pages explicitly run in **local demo mode**; the student page includes a roster switcher.

A host application can mount the views after its own login flow:

```tsx
import { mountTeacherApp, mountStudentApp } from './src/apps/mount';

const session = await yourLoginProvider.getVerifiedSession();
const element = document.getElementById('root')!;
const unmount = session.role === 'teacher'
  ? mountTeacherApp(element, { session })
  : mountStudentApp(element, { session });
// Call unmount() before your host tears down or replaces this view.
```

`AppSession` contains `{ userId, role, displayName }`. A student's `userId` must map to their roster ID. The static role entries also accept `window.__AIPC_SESSION__` if the host assigns it before the entry script executes. Mounting with an incompatible role shows an access message; authenticated mounts do not show the demo student switcher. Hosts can inject `PracticeGateway` and `ScoreGateway` implementations for their own services.

Authenticate API requests on the server as well. Mount the independent Node/Connect handlers with a trusted session resolver backed by your login provider's verified cookie/session:

```ts
import { scoreApiMiddleware } from './src/modules/score/server';
import { practiceApiMiddleware } from './src/modules/practice/server';

const options = {
  storageRoot: '/persistent/aipc',
  resolveSession: req => yourServerLoginProvider.getVerifiedSession(req),
};
server.use(scoreApiMiddleware(options));
server.use(practiceApiMiddleware(options));
```

Resolvers are synchronous and return an `AppSession` or `null`; perform asynchronous verification in the host middleware first and read its verified result here. Never treat a browser-provided ID, query parameter, or role header as verified identity. With a resolver, anonymous requests are rejected, students can update only their own assignments, teacher IDs come from the session, and teachers see only their own dispatched plans. Additional school/class authorization belongs in the host's integration/gateway. The repository is a local JSON development store, not a concurrent multi-server production database.

The default Vite middleware intentionally has **no login provider** and operates in demo mode. The existing archived APIs are still registered there for compatibility. Do not expose that demo middleware or the archived APIs as an authenticated production service. For production mount only the two domain handlers with the trusted resolver, or replace the gateways with your own backend. Vercel/static `dist/` hosting alone does not execute the development APIs.

## Persistence and compatibility

New plans are saved under ignored `storage/practice-plans/`. Existing `storage/exercises/*.json` assignments are read without rewriting them. Changing a legacy assignment's completion writes an override in the new plan directory, so old files remain intact. Legacy assignments have no teacher identity: they appear in the local `demo_teacher` dashboard only; production migration must assign a real teacher explicitly.

Existing uploaded scores keep the same metadata format and XML endpoint. New score uploads remain in `storage/scores/`. Set `AIPC_STORAGE_ROOT` to override the two domain handlers' storage directory for isolated testing; provide a `students.json` roster in that directory. The browser tests use a temporary root and do not alter the bundled roster, demo exercises, or uploaded score files.

The previous floating-window teacher UI, student companion/recording UI, and pedagogical strategy/knowledge code are retained under `src/legacy/` with imports updated. They are not mounted by the new role entry points. Old knowledge/storage APIs remain available in local Vite for compatibility. Future migration of recording/coaching features should use the new contracts rather than importing archived components across domain boundaries.

## Verification

- `npm ci` (Node 20.19+ or 22.12+, Node 24 tested).
- `npm test`: existing regression tests, repository tests, API authorization/round-trip tests, and import-boundary checks.
- `npm run build`: typecheck all source and build the role entry points.
- `npm run test:browser`: teacher upload/rendering, assignment dispatch, student completion and reopening, teacher polling, student isolation, shared viewer, independent workbenches.
- `npm run build:score` / `npm run build:practice`: standalone domain typechecks and workbench builds.

The browser test uses installed Chromium at `/usr/lib/chromium/chromium`; set `AIPC_CHROMIUM_PATH` for another installed browser binary. It starts and stops an isolated Vite server itself. Real microphone capture and audible quality need manual hardware testing.
