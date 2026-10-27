Developer B owns this domain. Read ../../../docs/DEVELOPER_BOUNDARIES.md for integration contracts and ownership.
Keep plan dispatch, student progress, plan management, and communication changes inside this directory and tests/practice.
Do not import the score domain, app shells, or legacy code. Receive ScoreReference data and onOpenScore callbacks through src/contracts.
Use npm run dev:practice and /dev-practice.html for independent development, npm run test:practice for domain tests, and npm run build:practice for the standalone build. Run npm test for boundary enforcement.
Coordinate changes to contracts, shared styles, manifests, and shell integration with Developer A.
