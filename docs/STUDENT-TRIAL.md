# Public Sunny Island student trial

Build with `npm run build:student-trial`. This creates a static student-only site in `dist` with Sunny Island, the annotated texture controls, FluidR3 and VSCO playback assets and their licences. Both `/` and `/student.html` open the trial directly. Relative asset URLs support a GitHub Pages project subdirectory.

There is no login, teacher portal, student roster, exercise inbox or storage API in the published output. Teacher submission is unavailable. Practice recordings are local to the visitor's browser; no recording upload is made by this trial. The part picker lets visitors try different instruments. Existing role annotations apply only to the exact supplied score revision.

## Enable hosting (repository owner)

1. Open https://github.com/fttuba-oss/AIPC/settings/pages .
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open https://github.com/fttuba-oss/AIPC/actions and the **Publish Sunny Island student trial** workflow.
4. If the initial deployment failed because Pages was not enabled, rerun the failed deployment job after enabling it. Future pushes to `codex/integrated-practice-audio` build and deploy automatically. If the workflow is later merged to another branch, update the push branch accordingly.
5. Wait for a successful deploy and use the URL in the deployment job or Pages settings. The expected default address is https://fttuba-oss.github.io/AIPC/ . Do not announce it as live until the deployment succeeds; a custom Pages domain may change this address.

The workflow uses GitHub's Pages deployment token and requires no third-party hosting account or committed credentials. Check repository/organisation Pages availability if GitHub does not offer the setting.

## Local preview

After building, serve `dist` using `npm exec vite preview -- --host 127.0.0.1 --port 5176`. This preview serves the built trial, whereas the ordinary development server remains the normal teacher/student application. The sound bank is substantial; the first playback needs time to download and initialise it. Browser audio begins after a Play or Preview gesture.

Publishing this trial makes the supplied Sunny Island score publicly downloadable alongside the app. The build copies that score only, not the storage folder or other uploaded scores.
