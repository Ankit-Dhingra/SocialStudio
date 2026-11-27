# SocialStudio production implementation status

## Phase 0 Repository audit and baseline protection

The implementation branch is `codex/production-saas`, based on `953f82385b98691baf94e382a10150b8bd2f10d2` from the current checkout. This baseline contains the working manual importer and the newer Groq visual path. The local `main` branch is at `7a42314` and was left on its original commit. This repository already uses `Docs`, so that directory holds the implementation record.

### Current application

| Area | Baseline |
| --- | --- |
| Frontend | `dashboard/src/main.jsx` is the React entry point. Vite proxies local API and media requests. `dashboard/src/pipeline-api.js` sends a per-browser capability stored in `localStorage`. |
| Backend | `src/api.ts` is the Express entry point. `src/core.ts` opens PostgreSQL and Redis connections. `src/worker.ts` is the BullMQ consumer and can also start inside the API process. |
| Session persistence | `src/modules/ai-script/master-script-service.ts` keeps a memory cache backed by individual JSON files in `media/sessions`. Narration, word timings, preview state, and visual revisions are attached to the file-backed sessions. `src/modules/pipeline/server-orchestrator.ts` tracks active pipeline work in process memory. |
| Separate video workflow | The older `/api/videos` path writes PostgreSQL rows using `db/schema.sql` and dispatches BullMQ jobs to `shorts`. Legacy progress and approval in this workflow are separate from the filesystem Studio sessions. |
| Rendering | Manual JSON and automatic Groq visuals share the production validator and compilation path. Remotion and FFmpeg produce stills, motion previews, and MP4s. Visual Director V2, the legacy references, and golden files are versioned separately from generated outputs. |
| Media | Local output is spread across `media/runs`, `media/generated-reel-visuals`, `remotion/public/audio`, `remotion/public/previews`, and `output`. |
| Tests and deployment | Root commands provide TypeScript and Node test checks. Vite provides the frontend production build. `Dockerfile`, `render.yaml`, `docker-compose.yml`, and `dashboard/vercel.json` hold deployment or local service configuration. The baseline has no tracked GitHub Actions workflow. |

Reviewed the existing Word system design PRD, video engine notes, example environment configuration names, Visual Director references, and the frontend, API, persistence, provider, and rendering entry points. The examples cover the existing PostgreSQL, Redis, provider, automation token, and Chrome settings. Clerk and production SaaS configuration still need to be added.

### Chargeable and resource-intensive routes

| Routes under `/api` | Operations |
| --- | --- |
| `POST /pipeline/script/start`, `/pipeline/script/chat`, `/pipeline/script/finalize` | Script creation, refinement, and finalization may call an LLM. |
| `POST /pipeline/audio/synthesize` | TTS and word alignment may call Sarvam, Groq Whisper, or another configured narration provider. |
| `POST /pipeline/stills`, `/pipeline/motion-preview`, `/pipeline/render` | Visual planning, optional artwork or verification, and Remotion rendering. A pinned manual revision can reuse compiled visuals. |
| `POST /pipeline/manual-visual/:sessionId/generate` | Compiles imported visuals and renders stills. Configured illustration generation may incur provider usage. Context and validation use local processing. |
| `POST /pipeline/generate-reel` | In-process generation orchestration across multiple stages. |
| `POST /previews`, `/videos`, `/videos/:id/retry` | Legacy provider or worker execution paths. Protect these independently of Studio authorization. |

The legacy API currently allows wildcard CORS. Static routes expose media by URL without an ownership check. An unbound legacy session may appear in the session list and lacks equivalent ownership enforcement to an already-bound session. The legacy automation guard accepts requests when its environment token is absent, and the Render blueprint includes a predictable development token. PostgreSQL and Redis client configuration permits disabled TLS certificate verification on configured paths. Provider calls are distributed across several modules and have no shared prepaid credit or global budget enforcement. These are release blockers for public generation.

### Backup and regression results

- The backup under `backups/saas-baseline-backup-953f823` holds 8,655 verified files totaling 1,958,045,357 bytes. `SHA256SUMS` records the per-file hashes. The directory is excluded from Git and Docker build contexts.
- Root TypeScript check and Vite production build passed. The full suite with the saved-session fixture enabled passed all 60 tests. The first sandboxed run failed two FFmpeg-dependent tests because FFmpeg exited with Windows status `0xC0000005`. The bundled executable and the full test suite passed outside the Windows app sandbox.
- With the WhatsApp saved session set, all four visual-directive tests passed. This run verified manual import validation and template bindings, and mocked the two automatic Groq visual paths. The manual audit recorded zero provider requests and verified the saved script, audio, and timeline hashes.
- In the existing owner's browser profile, the original WhatsApp reel opened from the local library, played at 1080 × 1920 for 148.416 seconds, reopened in Studio, and downloaded from the export screen. The original session and MP4 hashes match the backup.
- A separate render audit produced 16 stills, a 14.144-second motion preview, and a fresh full MP4 from the cloned WhatsApp session. The original 330-second polling deadline expired before the full export finished. An independent FFprobe check verified 148.416 seconds against 148.4 seconds expected, H.264 at 1080 × 1920, AAC audio, and the recorded SHA-256. The audit observed zero provider calls before polling ended. The audit test now allows up to 20 minutes for full exports while retaining the preview deadline.
- FFprobe verified H.264 video at 1080 × 1920 with AAC audio for five demo candidates on disk. WhatsApp runs 148.416 seconds, Load Balancing 18.219 seconds, Bloom Filter 31.637 seconds, Merkle Tree 42.944 seconds, and RAG 135.680 seconds. Demo selection and publication checks are pending.

### External account status and cost

- Render's SocialStudio workspace has the existing Free Docker web service. It tracks GitHub `main` and the latest deployment shown in the dashboard failed. The older running deployment returned a healthy response from [its health endpoint](https://socialstudio-backend-kuwv.onrender.com/health).
- The existing Vercel frontend displayed an earlier dashboard at [its public URL](https://social-studio-olive.vercel.app/). The account is on Hobby, which Vercel limits to personal, noncommercial use. [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- Clerk dashboard access succeeded. The preexisting application belonged to another project. Phase 1 provisioned a dedicated SocialStudio development instance.
- Atlas dashboard access succeeded. The visible Free cluster belongs to another project. A dedicated SocialStudio database and database credentials remain pending.
- Cloudflare dashboard access succeeded. R2 displays a subscription step with $0 due at activation and potential monthly usage charges. Subscription activation requires explicit approval and user completion.
- Razorpay redirected to its email or phone login. Account access and test mode remain unverified.
- GitHub repository settings show `main` as the default branch. The Vercel and Render project links point to the existing repository.
- Render Free Key Value loses its contents on restart. Recovery will need authoritative MongoDB state before queue dispatch is enabled. [Render Free Key Value limitations](https://render.com/docs/free#free-key-value)
- Phase 0 has used local disk and compute. No new paid resources or live financial settings were activated.

### Modified files and gate

`.gitignore` and `.dockerignore` protect local backups and build contexts. `tests/visual-directives.test.ts` accepts `REEL_MANUAL_AUDIT_OUTPUT` so repeated checks can avoid overwriting earlier results. The production renderer and prompts are the baseline versions. Phase 0 passed with the verified backup, 60 automated tests, browser download, and independent media QA of the fresh export. A full rerun through the revised polling window remains part of the rendering integration verification.

## Subsequent phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Clerk authentication and owner binding | Local verification passed. Live Express owner binding pending the development secret. |
| 2 | Public read-only demo | Implemented and locally verified. Public media deployment pending. |
| 3 | MongoDB persistence and owner migration | Pending |
| 4 | Cloudflare R2 and private media | Pending |
| 5 | Redis, BullMQ, workers, and recovery | Pending |
| 6 | Manual and Groq generation integration | Pending |
| 7 | Provider gateway and spending guard | Pending |
| 8 | Prepaid credits and plans | Pending |
| 9 | Trial infrastructure and abuse prevention | Pending |
| 10 | Razorpay test integration and reconciliation | Pending |
| 11 | Security and owner administration | Pending |
| 12 | Deployment and portable workers | Pending |
| 13 | Environment and operating documentation | Pending |
| 14 | End-to-end verification and capacity tests | Pending |
| 15 | Release readiness and rollback verification | Pending |

## Phase 1 Clerk authentication and owner binding

The React dashboard uses the official Clerk SDK for the sign-in and sign-up modals, account management, and logout. Signed-out visits keep the existing overview and route Studio actions to sign-in. The Express API accepts Clerk session bearer tokens for the configured frontend origin. MongoDB stores the application account keyed by the immutable Clerk user ID. Owner bootstrap requires verified email and a linked verified Google account. A database index limits the owner role to one account. Production owner endpoints also require a second factor verified within 15 minutes.

Hosted mode restricts the legacy API to isolated project reads, pasted-script editing, and local import validation. The generation and render actions need credit and spending enforcement before they can be enabled. Legacy file media stays off in hosted mode until private storage is in place. The loopback development mode retains the existing creator pipeline.

### Modified files

- `src/modules/accounts/` contains Clerk configuration, Express session and role middleware, and the Mongoose account model.
- `src/api.ts` mounts the hosted route gates. `src/modules/pipeline/session-owner.ts` binds hosted projects to authenticated Clerk IDs. `src/modules/ai-script/master-script-service.ts` persists ownership with the initial pasted script.
- `dashboard/src/AuthShell.jsx`, `dashboard/src/main.jsx`, `dashboard/src/pipeline-api.js`, and `dashboard/src/style.css` add Clerk navigation, account controls, and bearer requests within the existing layout.
- `.env.example`, the package manifests and locks, and `tests/accounts.test.ts` cover isolated configuration, dependencies, and regression checks.

### Verification and cost

- The full suite passed 64 tests with the saved-session fixture and local MongoDB enabled. The account tests used Clerk-compatible signed fixtures and the mounted Express routes to verify unauthorized rejection, cross-user isolation, owner MFA, suspended-user rejection, and forged-role rejection. MongoDB tests verified owner uniqueness, concurrent signup, persistence across reconnect, and no trial or plan entitlement at signup.
- The TypeScript check and Vite production builds passed. The Clerk-enabled Vite build used the development public key and produced its output separately from the original local dashboard.
- Chrome completed Google sign-in against the actual Clerk development instance. The browser retained the session after reload, opened the Clerk Account profile, and returned to signed-out controls after logout. The approved identity is registered in Clerk's development user list. It still needs an Express request with the development secret before the live MongoDB owner record is verified.
- The approved SocialStudio development instance is provisioned with Google and Email enabled. Browser automatic approval review rejected disabling Email, so the development instance retained both methods. Production Clerk configuration and real owner MFA enrollment remain pending.
- The database integration used a temporary loopback MongoDB process. No cloud database credentials, new paid resources, or production deployment changes were involved.

Phase 1 live verification needs the Clerk development secret and owner MFA enrollment. The fixture result for a normal member is recorded above. Independent phases can proceed while live verification is pending. See [owner setup](OWNER_SETUP.md) for the secure local configuration path.

## Phase 2 Public read-only demo

`/demo` is accessible without signing in. The homepage adds an Explore Demo link. The demo serves a curated catalog and supports browser range requests. The demo API has no provider, queue, account, or project database dependency and only serves allowlisted media names. The sign-in CTA opens Clerk on the existing homepage.

`npm run demo:prepare` stages the original MP4 bytes and extracts JPEG thumbnails locally. The five SHA-256 values are checked before media is made available. Originals remain in place. `DEMO_PUBLIC_BASE_URL` can serve the same names directly from a public demo bucket once it is ready.

| Reel | Verified runtime |
| --- | ---: |
| WhatsApp V2, featured | 148.416 s |
| Load Balancing | 18.219 s |
| Bloom Filter | 31.637 s |
| Merkle Tree | 42.944 s |
| RAG | 135.680 s |

The full suite with saved-session and local MongoDB fixtures passed 66 tests. TypeScript and the production dashboard build passed. Browser verification played all five 1080-wide originals without signing in and opened Google sign-in from the demo CTA. The published media bucket and public deployment remain pending. No new media renders or AI calls were used to create the demo.
