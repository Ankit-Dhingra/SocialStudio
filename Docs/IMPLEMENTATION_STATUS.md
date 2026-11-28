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
| 3 | MongoDB persistence and owner migration | Hosted project persistence and migration implemented and locally verified. Atlas database created on the Free cluster. Cloud application credential and live owner migration pending. |
| 4 | Cloudflare R2 and private media | Local private storage and R2 adapter implemented. Local streaming, expiry, and cleanup verified. R2 activation and live integration pending. |
| 5 | Redis, BullMQ, workers, and recovery | Free Render Key Value provisioned. Health monitoring and durable recovery implemented. Hosted generation workers and production wiring pending. |
| 6 | Manual and Groq generation integration | Saved local workflow regressed successfully. Hosted paid stages, previews, and renders remain gated. |
| 7 | Provider gateway and spending guard | Atomic cost reservation and settlement implemented and locally verified. Provider adapters, usage capture, and hosted enforcement pending. |
| 8 | Prepaid credits and plans | Expiring credit grants, atomic reservation, and balance reads implemented and locally verified. Production plans, admin allocations, and financial reconciliation pending. |
| 9 | Trial infrastructure and abuse prevention | Pending |
| 10 | Razorpay test integration and reconciliation | Test checkout and transactional reconciliation implemented and locally verified with fixture transport. Razorpay account verification and dispute handling pending. |
| 11 | Security and owner administration | Strict hosted auth, origin enforcement, owner-scoped media/project access, TLS and legacy route lockdown implemented. Full administration and release audit pending. |
| 12 | Deployment and portable workers | Existing Render failure investigated. Docker runtime and deployment examples updated. Release and hosted workers pending. |
| 13 | Environment and operating documentation | Staging configuration and external activation steps documented. Complete release runbook pending. |
| 14 | End-to-end verification and capacity tests | Node 22 regression suite and dashboard build passed. Hosted integrations and capacity measurement pending. |
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

## Hosted persistence and private media

The hosted project endpoints now read and write MongoDB using the authenticated Clerk subject. Pasted scripts, draft finalization, source pack downloads, manual import validation, and project archival use the existing script and visual engine where applicable. Updates compare revisions to prevent stale writes. The local creator still uses its existing session files. Hosted status reads never resume a legacy generation.

The migration command accepts explicit legacy IDs and defaults to a dry run. The saved WhatsApp project passed that check. Apply requires an active owner record with the pinned Clerk ID, preserves existing projects on repeat runs, and fails rather than moving an ID to another owner. Existing audio, timing, and visual metadata remain in the archived record. Private media can be copied from existing artifacts without regeneration. Hosted API responses only issue signed links for the requesting owner's registered files. Old raw local media paths stay disabled in hosted mode.

The `socialstudio` database and initial `users` collection were created on the existing Atlas Free `Cluster0` after approval. Data Explorer reported 237.57 kB of aggregate storage for the two existing databases before creation. Atlas applies the 0.5 GB quota to uncompressed BSON and indexes, so the browser storage figure verifies modest usage but gives no exact remaining quota. Other databases were left in place. No Atlas application credential or production project data has been written. [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)

## Queue and payment readiness

The Render Key Value instance uses the Free, nonpersistent plan in Virginia. The optional five-minute connectivity monitor reports owner-only health. The MongoDB job repository supports fenced claims, checkpoint recovery after queue data loss, and a `needs_review` state for expired execution with a provider call in flight. Hosted job status reads are owner-scoped. The dedicated worker dispatches committed reservations when generation is explicitly enabled in the environment.

The Razorpay integration uses test keys only. It builds orders from server configuration, checks the checkout and webhook signatures, and fetches canonical payment and dispute records. Captures, refunds, and dispute holds reconcile in MongoDB transactions. Test balances are isolated from generation entitlements. A local MongoDB replica set and fixture Razorpay transport verified the ledger. Actual Razorpay checkout and webhook delivery are pending test keys and a reachable HTTPS staging service.

Generation admission reserves expiring credits and daily global, user, provider, and trial budgets as applicable. It checks the monthly cap and records the durable job in the same transaction. The dedicated worker fences provider calls with the current MongoDB lease and applies the reserved attempt count. Reported token, audio and character usage is priced against configured rates where available. A call without sufficient pricing information records the configured ceiling as an estimate. Ambiguous transport outcomes hold the reservation for MFA-protected owner reconciliation. Project revision, artifact bindings, job completion and credit settlement commit together.

The final Node 22 run passed all 71 tests with none skipped. It exercised isolated local MongoDB, a local MongoDB replica set for transactions, local Redis with BullMQ, and the saved WhatsApp workflow with provider calls intercepted. The queue test removed a queued Redis entry and recreated it from MongoDB without duplicate dispatch records. TypeScript and the Clerk-enabled Vite production build passed. The local Redis binary is 5.0.14.1, below BullMQ's recommended 6.2.0 baseline, so managed Render compatibility still needs a staging smoke test. Live AI costs, actual payment-gateway traffic, and production capacity were outside these checks.

Render's November 14 deploy exited with status 1 while running the application. Detailed logs expired, so the precise startup exception could not be recovered from the dashboard. The existing deployment and uptime monitoring were left in place. See [staging integration instructions](SAAS_INTEGRATIONS.md) for configuration and blockers.

## Connected hosted execution verification

The hosted dashboard submits script, narration, automatic visual generation, still preview and export jobs against MongoDB project revisions. Manual ChatGPT JSON import saves the validated plan without a provider call, then uses the same worker for preview and export. The Master Visual Prompt V2, rendering composition and legacy creator workflow are preserved. The hosted API rejects the old generation endpoints. Optional illustration, motion preview and hosted script refinement still need their own guarded execution paths. The owner dashboard provides expiring credit allocations, plan presets, generation pause, job and provider usage visibility, and an MFA-protected review endpoint. Trial claims remain off. Isolated tests covered canonical email deduplication, the trial budget cap and the generation switch.

The Node 22 regression suite passed 72 tests, with the opt-in network test run separately and passing. TypeScript and the Clerk-enabled frontend production build passed. The dedicated worker reported ready against the local replica set and Redis. The hosted workflow used Clerk middleware with locally signed session fixtures and exercised MongoDB replica-set transactions, BullMQ and local signed media delivery. Both manual and automatic plans rendered a 17.5-second saved-narration excerpt as 1080×1920 MP4. The automatic Groq plan used fixture transport, and the visual test reused the original audio and Whisper timing. Both exports passed media QA and returned signed byte-range responses. A simulated provider timeout did not replay and required owner reconciliation before releasing credits. Local Redis 5.0.14.1 is below BullMQ’s recommended version. Managed Redis behavior and external account ownership await staging verification.

| Local 525-frame export | Elapsed | Node CPU | Peak Node RSS |
| --- | ---: | ---: | ---: |
| Manual with a cold bundle | 83.4 s | 23.7 CPU s | 900 MiB |
| Automatic with a reused bundle | 70.6 s | 10.3 CPU s | 421 MiB |

Each MP4 was 1,263,819 bytes. A process-tree sample observed 1.34 GiB in summed working sets across up to 15 processes and 191.4 accumulated CPU seconds among the sampled processes. This is a partial Windows sample, and summed working sets can count shared pages more than once. Rendering requires separate capacity testing on the intended worker. The API instance has neither the tested rendering headroom nor a concurrency benchmark.

Real synthetic smoke calls succeeded with Gemini 2.5 Flash, Groq Qwen 3.8 27B, Groq GPT-OSS 120B, Sarvam Bulbul v4 Flash and Groq Whisper Large v3. The three LLM calls used 16/5, 28/15 and 111/32 input/output tokens, respectively. Using published standard rates and Whisper’s 10-second billing floor, those three calls plus Whisper total approximately US$0.00044. The 30-character Sarvam test is approximately ₹0.03 before tax. These figures are estimates, and account credits or free tiers can change the eventual charge. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing.md) · [Groq Qwen pricing](https://console.groq.com/docs/model/qwen/qwen3.8-27b) · [Groq GPT-OSS pricing](https://console.groq.com/docs/model/openai/gpt-oss-120b) · [Whisper billing](https://console.groq.com/docs/speech-to-text) · [Sarvam pricing](https://docs.sarvam.ai/api/getting-started/pricing)

Native Windows production startup reproduced a V8 heap failure with the Dockerfile’s former 160 MiB old-space limit. With the new 320 MiB limit, Node 22.18 started against loopback TLS MongoDB with certificate validation and synthetic Clerk production-format settings. `GET /health` returned 200 and an anonymous `GET /api/account` returned 401. The startup API working set was 307 MiB. The machine has no Docker executable or installed WSL distribution, so the Linux image and current Render startup remain unverified. The fresh native heap failure does not identify the expired Render deploy exception.

Release remains gated on real Clerk backend authentication and MFA, the pinned owner and Atlas migration, managed Render Key Value, R2 private delivery and five public demos, and Razorpay test mode. Existing Vercel and Render deployments remain in service. Public paid generation, live payments and free trials remain disabled.

## Release verification follow-up

Hosted refinement uses the existing script editor through the reservation and provider gateway. Hosted motion preview uses the accepted visual revision and stored narration, with the same frame ranges and shot metadata as the creator workflow. The two worker roles claim separate operation sets. The default Docker target is the lightweight API, with separate generation and renderer targets. Paid illustrations and the legacy motion direction and screenshot upload endpoints remain unavailable to hosted requests.

The full local suite passed 72 tests, and the eight focused integration checks passed after the readiness and admission changes. These checks covered signed account isolation, stale visual revisions, simultaneous submissions against one credit reservation, trial limits, payment webhook signatures and disputes, and recovery from ambiguous provider outcomes. The fixture refinement recorded one bounded Groq call. The motion preview fetched persisted audio, recorded no provider calls, and played through the signed range endpoint. The broader suite retained the Redis lost-entry recovery and malicious visual JSON checks. TypeScript and the Clerk-enabled frontend build passed.

The Windows production-mode API reported 200 for health and readiness, 401 for anonymous account access, and 325 MiB RSS at the check. Readiness verified MongoDB and Redis with loopback TLS fixtures. The shutdown handler closed the listener and connections after an in-process SIGTERM signal. Both worker roles booted separately without Clerk credentials. These are native diagnostics. No Docker runtime or installed WSL Linux distribution was found, so a Linux image build, real container signal delivery, and Render runtime memory still need staging verification.

| Local traffic benchmark | Requests | Concurrent clients | p95 | Throughput |
| --- | ---: | ---: | ---: | ---: |
| Public catalog | 250 | 20 | 228 ms | 157 requests/s |
| Public 64 KiB video range | 250 | 20 | 235 ms | 117 requests/s |
| Signed dashboard listing 25 projects | 250 | 20 | 779 ms | 51 requests/s |
| Direct MongoDB project reads | 250 | 20 | 178 ms | 268 reads/s |
| Isolated Redis enqueue fixture | 100 | 10 | 29 ms | 1,323 enqueues/s |

The benchmark shared a Windows host with the render verification, and the load client ran in the API process. Combined sampled RSS peaked at 382 MiB. The 100 waiting Redis jobs used 67,567 bytes in queue keys. Public catalog and media reads added zero durable generation jobs. The five video and thumbnail pairs total 26,376,764 bytes. These figures do not establish cloud load limits or simultaneous generation capacity for 1,000 registered accounts. Each configured worker processes one job at a time. Renderer elapsed times this run were 136 seconds cold and 84 seconds warm for the two 17.5-second exports, and 55 seconds for the 15-second motion preview. The motion worker’s Node RSS peaked around 396 MiB, excluding Chromium and FFmpeg. Sustained live generation throughput and cloud renderer capacity remain unmeasured.

The current Vercel frontend and Render health endpoint returned HTTP 200. The deployed Render demo catalog returned 404, so there was no published catalog to verify for guest playback. Browser automation could not initialize on the host. The staging R2 and Razorpay test checkout gates remain as documented in [staging setup](SAAS_INTEGRATIONS.md).

Automatic approval review blocked sending the saved WhatsApp V2 visual-planning payload to Groq. No saved-project data or additional live provider requests were sent during this verification. The opt-in verification script reserves at most US$0.056 across eight requests and keeps source audio local. The previously recorded five synthetic provider smokes remain the live provider evidence. Actual scene acceptance, repairs, usage, cost and MP4 quality for the saved-project live run remain pending explicit approval.

## Authorized live verification and Linux CI

The subsequent approved WhatsApp V2 run sent the saved storyboard, narration text and Whisper word timings to Groq. Seven requests returned HTTP 200. Scenes 1 and 3 passed span validation, and the other 14 scenes remained unaccepted. The full directive could not be compiled, so the run produced no MP4. The audio stayed local. No narration or alignment provider was called.

Groq reported 41,412 input and 7,180 output tokens and 17.18 seconds of combined provider time. The estimated list-rate cost was US$0.010523 against the US$0.056 reservation. The run crossed midnight UTC and recorded 7 hours 49 minutes of wall time. The original report counted 30 overlapping planner iterations, including local iterations after the outbound calls stopped. It did not distinguish the number of metered repair requests. The planner now stops immediately on a closed spending window, exhausted quote, pause, or uncertain provider result. Future incomplete runs save the validated partial draft locally and distinguish repair requests with provider responses from local iterations. The saved narration regression verifies the immediate stop. [Groq model pricing](https://console.groq.com/docs/model/openai/gpt-oss-120b)

The release branch was pushed to the existing public GitHub repository. The Linux workflow passed twice on a standard runner, including the provider-stop fix. It built the API and both worker images, used verified MongoDB TLS and a Redis 7 fixture, exercised health, readiness and anonymous rejection, and verified both worker startup modes and SIGTERM shutdown. Docker reported 294.7 MiB for the API at a 512 MiB limit, 390.8 MiB for the idle generation worker, and 393.7 MiB for the idle renderer. The samples do not include active generation or rendering. Managed services and a deployed release still require staging verification. [Linux verification run and annotations](https://github.com/Ankit-Dhingra/SocialStudio/actions/runs/46099532509) · [GitHub Actions public runner billing](https://docs.github.com/en/actions/concepts/billing-and-usage)

The final local regression passed 72 tests with the separate opt-in provider smoke disabled. Both saved-audio fixture exports and the 15-second motion preview rendered and played through signed byte-range responses. TypeScript and the focused provider-stop regression passed. The remote production branch was unchanged and GitHub listed no deployment records for the release branch.

Both scoped browser helpers failed before showing an authenticated surface. The official Clerk, Atlas, and Render CLIs were prepared in ignored tooling and opened authorization flows for the existing accounts. Account consent is still pending. Clerk supports pulling the selected development keys directly into an env file after consent. The Clerk development secret is still absent from the Git-ignored environment file. Owner and MFA checks, scoped Atlas credentials and project migration, managed Render Key Value, Cloudflare R2, and Razorpay test credentials and checkout remain pending. The public frontend and API health endpoint still returned 200, and the public demo catalog returned 404. R2 activation was not attempted, and current account-specific terms could not be inspected. [Clerk CLI](https://clerk.com/docs/cli) · [Atlas CLI login](https://www.mongodb.com/docs/atlas/cli/current/command/atlas-auth-login/) · [Render CLI](https://render.com/docs/cli) · [Cloudflare R2 public pricing](https://developers.cloudflare.com/r2/pricing/)

Render CLI authorization subsequently succeeded. The SocialStudio workspace reports `socialstudio-queue` available on the free Virginia plan, with persistence off, `noeviction`, and zero external allowlist entries. The verified private URL and health monitor flag are saved in ignored local staging settings. The local PING did not reach the private datastore. End-to-end connectivity and recovery still require a Render staging service on the private network. The authenticated deployment history shows `ca297c0` live on the existing API and the two newer `main` deployments failed. No production configuration changed. [Render Key Value connections](https://render.com/docs/key-value#connect-to-your-key-value-instance)

Clerk CLI authorization succeeded for the approved account. The key was pulled from the existing SocialStudio development instance into the Git-ignored backend environment after matching the configured development domain. The real Clerk Backend API verified the pinned ID, the approved email, and its verified Google connection. The account code persisted the active owner in dedicated loopback MongoDB. The Clerk-enabled production frontend build passed, and the loopback Express account route returned 401 for an anonymous request. A migration dry run verified the selected saved WhatsApp project.

The development instance offers authenticator-app MFA and backup codes, with enrollment optional for members. Clerk confirmed that the pinned owner enrolled MFA. Express returned 403 from `GET /api/admin/generation` before recent second-factor verification. After a fresh Google sign-in and authenticator challenge, the real browser session returned 200 from both `GET /api/account` and `GET /api/admin/generation`, with the pinned owner role and recent MFA confirmed. Production Clerk configuration remains pending, and production MFA requires a paid Clerk plan under the current Clerk terms. Atlas authorization and the cloud migration remain pending. [Owner setup](OWNER_SETUP.md) · [Clerk MFA](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#multi-factor-authentication)

Atlas CLI authorization succeeded. The existing DevTinder `Cluster0` is a free M0 replica set. The dedicated app credential is restricted to `Cluster0` and has only `readWrite` on `socialstudio`. Its connection settings are in an ignored staging file. The shared network rules and existing database users were preserved. The app connected over certificate-validated TLS, saved the verified owner in Atlas, checked the required account and project indexes, and verified transaction rollback.

The migration dry run validated all 18 legacy records. The nine completed projects with verified local MP4s were migrated as metadata. The nine unfinished records remain local because their draft and test provenance is mixed. The replay inserted zero additional records. Readback matched the normalized source metadata, a different owner ID could not read the records, and the source JSON hashes stayed the same. Media remains local while R2 is pending. A separate loopback Express instance backed by Atlas returned 200 for readiness, 401 for an anonymous project request, and 200 with all nine projects for the signed-in owner in the Studio browser. The original local creator workflow and production deployments remained on their existing configurations.

## Cloudinary staging and Linux verification, November 28, 2026

Cloudinary Free replaced R2 for hosted media. The staging application credential has Contributor access only on `socialstudio-staging`. A synthetic authenticated upload and retry passed. Signed reads matched the source bytes, byte-range seeking worked, and unsigned and expired links were denied. The loopback Studio returned the signed fixture link to the verified Clerk owner and returned 401 to an anonymous project list request. The initial WhatsApp preview failed from the prior page state. After `0acc896` changed Play to request a fresh signed link, the owner confirmed playback. The loopback logs recorded HTTP 200 for the verified owner and successful loading of WhatsApp video data in the Studio player. The Cloudinary copy matched the original bytes.

The approved five original demos and their thumbnails were published under `socialstudio-demo`. The unauthenticated catalog returned all five reels and all ten assets returned valid CDN byte ranges. The nine existing Atlas owner projects received 113 private media bindings after a dry run and a file-size preflight. All nine signed exports resolved and an unrelated owner could not retrieve any of the records. The migration inserted zero additional project records and read the original files without modifying them.

The Linux release workflow built and verified the API, generation worker, and renderer images for `d1e36d3`. The existing Render workspace has a backend and a free Key Value instance, with no staging service to reuse. Managed Redis, Razorpay test checkout and webhooks, production Clerk and DNS, media retention, and rollout remain pending. The existing production deployment remained in service. [Linux release verification](https://github.com/Ankit-Dhingra/SocialStudio/actions/runs/46110153679)

## Final staging and deployment, November 28, 2026

| Area | Observed status |
| --- | --- |
| Render production | The existing `main` backend returned 200 on `/health` and 404 on the new `/api/demo/reels`. Production rollout is on hold until staging passes. [Health check](https://socialstudio-backend-kuwv.onrender.com/health) |
| Vercel | The existing production page returned 200. The Vercel-authenticated release branch preview opened in Chrome and showed “Sign-in is unavailable.” It requires staging API and Clerk preview configuration and deployed end-to-end checks. [Production](https://social-studio-olive.vercel.app/) · [Branch preview](https://social-studio-git-codex-d0540d-ankitdhingra1909-5016s-projects.vercel.app/) |
| Render staging | The staging container at `eebc0a9` passed Linux CI with fixture MongoDB and Redis. A separate Free Virginia API is pending approval to transfer the existing scoped staging credentials to its secret store. Managed private-network Redis, memory, restart, and graceful shutdown remain unverified on Render. [Linux staging check](https://github.com/Ankit-Dhingra/SocialStudio/actions/runs/46111802928) |
| Billing | Render Hobby showed $0.00 month to date and projected, no card, 373.43 of 750 free instance hours used, 8 of 500 pipeline minutes used, and 789 MB of 5 GB bandwidth used. [Render billing](https://dashboard.render.com/billing) |
| Razorpay | The existing account opened in Test Mode. Generating the persistent test credential is awaiting confirmation. Live checkout is disabled. Test checkout, webhook delivery, captured payment, duplicate handling and refund reconciliation remain unverified with Razorpay. |
| Production Clerk | A new default production instance exists. Clerk initially assigned the parent domain, `devmatch.online`, which is unverified. The proposed switch to the dedicated `socialstudio.devmatch.online` secondary application awaits confirmation. The authoritative Cloudflare zone and existing Vercel domain inventory were verified. DNS and certificates are pending. Google Cloud requires the account holder to enable two-step verification before its OAuth credential settings open. Production Google sign-in remains pending. |
| Owner access | The dual-instance verification and owner mapping are implemented. The regression verifies access to the original project under the pinned new Clerk ID and rejects a mismatched Google subject, the prior ID at the production boundary, and an existing second application account. The actual production owner mapping and nine-project login are pending production sign-in. Hosted production administration defaults to disabled. |
| Cloudinary | Live Admin API usage reported 0.79 of 25 Free credits, 24.21 remaining, 142,445,128 storage bytes, 432,886,364 delivered bytes, and 256 transformations. The console showed a different value of 0.20 credits at inspection. The command output records the API measurement. The Free plan page showed $0. Media limits, thumbnail-first demo playback and operator usage reporting are implemented. [Cloudinary credit accounting](https://cloudinary.com/documentation/developer_onboarding_faq_track_credits) |
| Generation | Hosted controls expose manual paste, visual plan import for projects with saved narration, and saved-media playback. Hosted generation, trials, live payments, and Automatic Groq remain disabled for release. A hosted worker and its job admission have not been verified. Render does not offer free background worker compute. [Render Free compute](https://render.com/docs/free) |

TypeScript, the Clerk-enabled dashboard build, and 74 local regression tests passed. The opt-in live provider test was skipped. The suite used local MongoDB and Redis and covered job recovery, the Razorpay fixture ledger, and application owner binding. Chrome loaded all six thumbnail elements in the local guest demo with no video element present. After Play, all five published Cloudinary MP4s advanced with playable media in the browser. This playback check used the updated loopback build and the actual published Cloudinary assets.

No new charges or subscriptions were approved. The release changes are committed locally as `433b16b`. Automatic approval review blocked the push to the existing GitHub release branch pending explicit authorization for the destination. The current release is a portfolio candidate pending staging verification and production rollout. The existing deployments still serve their older release.

## Portfolio mode readiness and handoff verification, November 28, 2026

- **Portfolio-only production startup (`aa763f4` on `codex/production-saas`):** Added fail-closed `SOCIALSTUDIO_DEPLOYMENT=portfolio` support in `src/modules/accounts/auth-config.ts`, `src/core.ts`, and `src/api.ts` so the production API boots without Clerk, Atlas, Razorpay, Redis, or legacy workers, serves `/health`, `/ready`, and `/api/demo/reels` from Cloudinary, closes all other `/api/*` routes (`403`) and legacy static media (`/media`, `/audio`, `/previews`, `/output` -> `404`), and ignores legacy `START_WORKER` / `REDIS_URL`. Updated `dashboard/src/main.jsx`, `dashboard/src/DemoLibrary.jsx`, and `dashboard/src/AuthShell.jsx` so signed-out portfolio visitors cannot open the `create` view or follow a dead `/studio` link from `/demo`.
- **Deployment baseline and rollback audit:**
  - `origin/main` is at `7a42314`. Live Vercel (`https://social-studio-olive.vercel.app/`) serves the older bundle (`index-BaqXLG9M.js`, pointing `VITE_API_URL` at `https://socialstudio-backend-kuwv.onrender.com`, no `/demo`, no Clerk key).
  - Render `socialstudio-backend` (`srv-dbq93doae00c73ab8lt0`, Free Docker, Virginia, tracks `main`, `autoDeploy: yes`) is live on deploy `dep-dbr8ofu8bjmc73bgt9b0` (`ca297c0`), while its latest deploy `dep-dbsa5m6417fc73fa4oa0` (`7a42314`) failed. Recent Render runtime logs show the legacy in-process BullMQ worker hitting Upstash Redis `ERR max requests limit exceeded` (`500005 / 500000`). Render Key Value `socialstudio-queue` (`red-dc4r9p5g1s2s73fhgjbg`) is `available`.
- **Verification after edits:** `npm run check` (`tsc --noEmit`), `npm --prefix dashboard run build`, and **75 / 75** local regression tests passed (0 skipped, 0 failed) against standalone MongoDB (`27029`), replica-set MongoDB (`27030`), Redis (`26381`), and saved WhatsApp session `session_e9ca863a-a3ee-4345-9e58-4d4860631836`. Guest browser verification against the local portfolio build (`127.0.0.1:4099`) confirmed `"Sign-in is unavailable."`, zero `/api/pipeline/sessions` calls when clicking Studio controls, `"Studio sign-in unavailable"` on `/demo`, 6 loaded thumbnails with zero `<video>` elements before Play, HTTP `206` playback and midpoint seeking across all 5 Cloudinary demos, and `403` on protected endpoints. Linux CI run [46123156652](https://github.com/Ankit-Dhingra/SocialStudio/actions/runs/46123156652) for `aa763f4` completed with `success`.
- **Live provider checks:** Cloudinary Admin API reported `Free` plan (`0.79 / 25` credits used, `24.21` remaining, `142,445,128` storage bytes, `432,886,364` bandwidth bytes, `256` transformations); all 5 demo MP4/JPEG pairs passed live `206` range checks. Atlas readback verified 9 owner projects, 113 unique media links, 9 signed exports, and unrelated-owner denial on `DevTinder Cluster0` (`socialstudio` db); `atlas projects list` showed 12 existing org projects (11 with clusters) and no dedicated `SocialStudio` project yet. Clerk CLI listed `SocialStudio` (`app_3MgMLr8N1EUxsK0bQlS9W4hiDvC`) with `development` (`ins_3MgMLspYBuXJgvA6BK2FfGVjpFL`) and detached `production` (`ins_3MirdVJ72RHQRz2xRFCL6BOLEjP`, assigned `devmatch.online`).
- **Remaining external blockers:** Interactive browser/CLI access to Render and Vercel dashboards (to inspect/update env vars and verify production deploys), dedicated SocialStudio domain decision and Google Cloud 2SV for production Clerk/OAuth, Atlas dedicated project/cluster confirmation within `$0` limits, Render staging service creation, and Razorpay Test Mode key/webhook setup.

## Live portfolio rollout verified, November 28, 2026

- **Git & CI:** Fast-forward merged `codex/production-saas` (`b09cc73`) into `main` (from `7a42314`) and pushed `main` to `origin`. Linux CI run [46123156652](https://github.com/Ankit-Dhingra/SocialStudio/actions/runs/46123156652) for `aa763f4` passed.
- **Render production backend (`srv-dbq93doae00c73ab8lt0`):** Set Health Check Path to `/health`, `START_WORKER=false`, `SOCIALSTUDIO_DEPLOYMENT=portfolio`, `FRONTEND_URL=https://social-studio-olive.vercel.app`, `DEMO_PUBLIC_VIDEO_BASE_URL`, `DEMO_PUBLIC_IMAGE_BASE_URL`, `STUDIO_GENERATION_ENABLED=false`, `STUDIO_TRIALS_ENABLED=false`, and `RAZORPAY_TEST_ENABLED=false`. Deploy `dep-dc58rblbedkc73ef9q70` (`b09cc73`) went `Live` with zero Upstash/worker errors. Render Hobby billing showed `$0.00` MTD/projected, no card on file, `376.22 / 750` free instance hours, `796 MB / 5 GB` bandwidth, `8 / 500` pipeline minutes, and `2 / 25` services.
- **Vercel production frontend (`prj_IzxQGsxbKESILLuHG4JJhxlpvwNj`):** Deployment `dpl_H7GUTXXnos4t6tuZynMy5bdVZtHV` (`b09cc73`, `main`, `Ready`) serves [https://social-studio-olive.vercel.app/](https://social-studio-olive.vercel.app/). Branch preview `HGtsvAJtq6wGmguwu9PzTpzeGRNf` (`b09cc73`) was also verified prior to `main` rollout.
- **Live signed-out production verification:** Confirmed `/` shows `"Sign-in is unavailable."` and blocks Create/Drafts/Library navigation (`0` `/api/pipeline/sessions` requests), `/demo` shows `"Studio sign-in unavailable"`, loads `6` Cloudinary thumbnails (`200`) with `0` `<video>` elements before Play, plays and seeks all 5 Cloudinary MP4s (`206`) cleanly, repeats cleanly after reload with `0` `localhost` requests, returns `200` on `/health`, `/ready` (`{"status":"ready","mode":"portfolio"}`), and `/api/demo/reels` (5 items), returns `403` on all protected/legacy `/api/*` endpoints (`/api/account`, `/api/credits/balance`, `/api/pipeline/sessions`, `/api/pipeline/jobs`, `/api/pipeline/render`, `/api/pipeline/audio/synthesize`, `/api/pipeline/script/start`, `/api/admin/generation`, `/api/billing/test/plan`, `/api/videos`), and returns `404` on `/output/whatsapp-v2.mp4`.
- **Remaining gates (Section 2 & 3):** Authorization to create a separate Free Virginia Render staging API service and transfer scoped staging credentials, create a dedicated `$0` `M0` SocialStudio Atlas project/cluster (and copy the 9 verified projects), deferring custom-domain production Clerk until a dedicated SocialStudio domain is selected, and generating Razorpay Test Mode keys + staging webhook verification.

## Handoff follow-up for dedicated staging, November 28, 2026

- **Production:** The Vercel demo and Render readiness returned 200. Readiness reported `portfolio`, the catalog returned five reels, and the production Razorpay test-plan route returned 403. [Demo](https://social-studio-olive.vercel.app/demo) · [Readiness](https://socialstudio-backend-kuwv.onrender.com/ready)
- **Atlas:** The Atlas CLI confirmed that the dedicated SocialStudio project has zero clusters. The handoff recorded the prior M0 API quota rejection. Dedicated migration remains pending an available Free cluster. The DevTinder database remains the read-only source for the reviewed owner and nine projects. The approved setup leaves the existing clusters, credentials, network access lists, and DNS in place.
- **Copy readiness:** Added a dry-run and transactional copy command for the nine reviewed projects and 113 existing Cloudinary media bindings. It verifies the separate destination hostname and refuses a conflicting destination. The local MongoDB replica-set regression verified the dry run, first copy, zero-insert replay, and conflict rejection. TypeScript passed. The local regression run passed 76 tests and skipped the opt-in provider smoke test. No live migration was run. [Staging runbook](SAAS_INTEGRATIONS.md#clerk-and-atlas)
- **Render and Razorpay:** Render listed the existing production API and confirmed `socialstudio-queue` is available on Free in Virginia. The separate staging API, credential transfer, deployed private-network Redis verification and Razorpay Test Mode checkout remain pending. Production Clerk awaits a dedicated SocialStudio domain, and Google Cloud still needs account-side two-step verification.

### Dedicated Atlas cluster provisioned

After the owner freed Atlas capacity, the CLI created `SocialStudio` on the Free M0 tier in AWS `US_EAST_1` within the dedicated SocialStudio project. Atlas confirmed the cluster is available. Automatic approval review blocked creation of the scoped database user and a four-hour workstation IP entry pending explicit authorization. The copy of the nine reviewed projects and 113 existing media bindings remains pending those access grants.
