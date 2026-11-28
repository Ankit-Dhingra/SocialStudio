# SocialStudio staging integrations

The local creator workflow and the currently running Render deployment are independent of this branch. Use staging credentials and leave public paid generation, live payments, and free trials disabled.

## Clerk and Atlas

Complete the development Clerk steps in [Set up the Studio owner](OWNER_SETUP.md). Begin with the local MongoDB URL already configured for the owner check.

The verified Clerk development owner and the nine completed projects are now in the existing Atlas `socialstudio` database. The scoped Atlas connection is stored separately from the original local owner verification settings. The nine reviewed projects have 113 authenticated Cloudinary media links. Readback verified all nine signed exports and an unrelated owner could not retrieve the records.

### Production domain and owner identity

The separate SocialStudio production instance was created with Clerk's default features and remains detached. Clerk initially assigned `devmatch.online`, and the proposed switch to a DevMatch subdomain was cancelled. The owner must select a dedicated SocialStudio domain before production Clerk configuration proceeds. Once selected, obtain the Frontend API, Account Portal, and email CNAMEs from Clerk's Domains page. Add them in the dedicated domain's DNS zone and attach the Studio application hostname to the SocialStudio Vercel project using the DNS record Vercel provides. Verify certificates before switching production traffic. [Clerk production setup](https://clerk.com/docs/guides/development/deployment/production)

Configure a Google web OAuth client for the exact application origin and paste the redirect URI shown by the production Clerk Google connection. Register only the intended app origin in production, use the production publishable key in Vercel, and set the matching publishable and secret keys and exact `FRONTEND_URL` in Render. The API checks the token issuer and authorized party against this configuration. Keep `STUDIO_PRODUCTION_OWNER_ADMIN_ENABLED=false` while the production instance lacks MFA. Turning it on also requires a recent second factor in the signed session. [Google connection setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) · [Clerk MFA plans](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#multi-factor-authentication)

Have the owner sign in with Google on the production Clerk instance before routing that frontend to the dedicated application database. Review the two Clerk IDs in the respective dashboards. Run `npm run owner:verify-production` with the development secret in `CLERK_DEV_SECRET_KEY`, the production secret in `CLERK_SECRET_KEY`, the production ID in `OWNER_CLERK_USER_ID`, the old ID in `OWNER_PRIOR_CLERK_USER_ID`, and the expected `OWNER_EMAIL` and scoped Atlas `MONGODB_URI`. The verification command compares the two verified Google subjects, checks the existing active owner and absence of a conflicting application account, then prints a subject digest and visible project count. Set that digest as `OWNER_GOOGLE_SUBJECT_HASH` and both reviewed IDs on the production backend before the first application request. The production session resolves to the existing Studio owner record after verification. Existing project and credit ownership stays bound to the original Studio identity. Staging continues to use the original development sign-in. Confirm all nine projects from a production session before cutover.

The dedicated Atlas SocialStudio project has an available Free M0 cluster named `SocialStudio` in AWS US East (N. Virginia). The owner approved a database user with `readWrite` limited to `socialstudio` on that cluster and a four-hour access entry limited to the migration workstation. The reviewed library copy from the DevTinder source is complete. For the hosted staging API use the dedicated connection in the ignored operator environment. Use the actual staging service's outbound CIDR ranges for dedicated Atlas access after approval. [Atlas access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/) · [Render outbound addresses](https://render.com/docs/outbound-ip-addresses)

For the dedicated cluster copy, configure `SOURCE_MONGODB_URI`, `DESTINATION_MONGODB_URI`, `DESTINATION_ATLAS_HOST`, and the verified development `OWNER_CLERK_USER_ID` in the ignored operator environment. Supply the nine reviewed IDs from the existing inventory. Run the copy before starting the staging API against the new database. Review the dry-run count, then apply. The command reads only the selected owner and project records from the source, copies the existing Cloudinary binding keys, and checks the destination on replay.

```powershell
$reviewedIds = Get-Content backups/saas-tooling/cloudinary-reviewed-ids.json -Raw | ConvertFrom-Json
node --env-file=backups/saas-tooling/library-copy.env --import tsx scripts/copy-reviewed-owner-library.ts @reviewedIds
node --env-file=backups/saas-tooling/library-copy.env --import tsx scripts/copy-reviewed-owner-library.ts --apply @reviewedIds
```

After readback confirms nine projects and 113 bindings, check all nine signed exports via the staging account and verify an unrelated account is denied.

In Clerk, open **SocialStudio → Development → Developers → API keys** and set the default secret as `CLERK_SECRET_KEY` in the ignored `.env.socialstudio-clerk.local`. Keep the value in the local secret file or the staging secret store. Verify the signed-in Google account on `GET /api/account`, pin its Clerk ID as `OWNER_CLERK_USER_ID`, set up a second factor, and confirm `GET /api/admin/access` with a recent factor before moving to Atlas.

Once the application has provisioned the verified owner, run the migration with explicitly selected `session_…` identifiers. Review the dry run first. The migration creates missing records, preserves existing records and original files, and never resumes interrupted legacy generation.

```powershell
node --env-file=.env.socialstudio-clerk.local --import tsx scripts/migrate-owner-projects.ts session_UPDATE_ME
node --env-file=.env.socialstudio-clerk.local --import tsx scripts/migrate-owner-projects.ts --apply --copy-media session_UPDATE_ME
```

Omit `--copy-media` when migrating metadata only. Check the reported media count against the selected project before switching its delivery path. Media references whose source files are missing are left unavailable. Production rejects MongoDB connections that disable TLS or certificate and hostname verification.

## Cloudinary media

1. Use the Cloudinary Image & Video API Free plan for owner staging. Create a Media Library User key and grant it Contributor on the staging asset folder through the Cloudinary Admin API. In the backend and worker secret stores, set `PRIVATE_MEDIA_DRIVER=cloudinary`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Use the same `CLOUDINARY_PRIVATE_PREFIX` on the API and workers, matching the assigned asset folder. The default is `socialstudio-private`. Use `PRIVATE_MEDIA_DRIVER=local` and a strong `PRIVATE_MEDIA_SIGNING_KEY` for loopback testing.
2. Upload a synthetic video through the driver. Its original and derivatives use the authenticated delivery type. Confirm an unsigned URL and an expired URL are denied, authorized playback and seeking work, and another Studio account cannot obtain a project link. Links expire after 15 minutes. The driver applies the Free plan limits of 100 MB per video or audio upload and 10 MB per image. Review upload sizes and available credits before copying saved media.
3. For guest demos, run `npm run demo:prepare`. Upload only the five approved MP4s and five JPEGs with public IDs `socialstudio-demo/<reel-id>` using public upload delivery. Set `DEMO_PUBLIC_VIDEO_BASE_URL=https://res.cloudinary.com/<cloud-name>/video/upload/socialstudio-demo` and `DEMO_PUBLIC_IMAGE_BASE_URL=https://res.cloudinary.com/<cloud-name>/image/upload/socialstudio-demo`. Verify guest playback and seeking before publishing the catalog.
4. Monitor the shared Free plan credit balance during staging. R2 is disabled in the application. The local `npm run media:cleanup` command only removes expired local `tmp-` objects.

`CLOUDINARY_MAX_IMAGE_UPLOAD_BYTES` and `CLOUDINARY_MAX_VIDEO_UPLOAD_BYTES` can lower the limits for new private uploads. The second setting also covers audio. Defaults are 10,000,000 and 100,000,000 bytes. Existing media remains readable within the provider's limits. The demo player fetches thumbnails first and attaches the MP4 when the viewer chooses Play.

Run `npm run media:cloudinary-usage` in the operator environment with `CLOUDINARY_CLOUD_NAME` and either the current `CLOUDINARY_USAGE_OAUTH_TOKEN` or an Admin API credential in `CLOUDINARY_USAGE_API_KEY` and `CLOUDINARY_USAGE_API_SECRET`. Keep usage credentials in the operator environment. The command reports storage, bandwidth, transformations and credits remaining. Exit status 2 means the configured `CLOUDINARY_USAGE_WARN_PERCENT` was reached. The default threshold is 80%. Check the account dashboard separately when that account has other product environments.

The live staging check on November 28, 2026 used the scoped Contributor key and a synthetic MP4. Cloudinary accepted authenticated upload and a repeat with overwrite disabled, returned the original bytes on a signed download, supported byte-range seeking, and denied unsigned and expired links. The signed-in owner received the synthetic link from the loopback Studio API. An anonymous project list request returned 401.

All five approved originals and their thumbnails are published on Cloudinary Free. The production guest demo catalog returned five reels and every listed asset returned valid CDN byte ranges.

[Cloudinary Free plan](https://cloudinary.com/pricing/compare-plans) · [Authenticated media](https://cloudinary.com/documentation/control_access_to_media) · [Billing and credits](https://cloudinary.com/documentation/billing_and_plans)

## Render Key Value

The `socialstudio-queue` instance is in the existing SocialStudio workspace, Production environment, and Virginia region. The selected Free plan is $0 per month, 25 MB of RAM, with persistence off and `noeviction`. External access was disabled in the dashboard. When the updated backend is ready to roll out, copy the instance's internal connection URL into the backend `REDIS_URL` environment variable and optionally set `REDIS_HEALTH_CHECK=true`. The owner-only `/api/admin/redis-health` endpoint reports the cached connectivity result. Existing backend uptime monitoring continues to use `/health`. [Render Key Value](https://render.com/docs/key-value)

Render's failed November 14 deploy at `7a42314` recorded an application runtime exit with status 1. The deploy page no longer contains the detailed logs. The seven-day Hobby retention period had passed at inspection, so the failing exception is unavailable. The older running deployment was left in place. [Failed deploy](https://dashboard.render.com/web/srv-dbq93doae00c73ab8lt0/deploys/dep-dbsa5m6417fc73fa4oa0) · [Render log retention](https://render.com/docs/logging#retention-period)

For isolated hosted portfolio-only rollout (`SOCIALSTUDIO_DEPLOYMENT=portfolio` with `NODE_ENV=production`), the API boots without Clerk, MongoDB, Redis, Razorpay, or workers, serves `/health`, `/ready`, and `/api/demo/reels` using `DEMO_PUBLIC_VIDEO_BASE_URL` and `DEMO_PUBLIC_IMAGE_BASE_URL`, restricts CORS to `FRONTEND_URL` when set, and rejects all other `/api/*` requests with HTTP `403`. It refuses to start if `STUDIO_GENERATION_ENABLED=true`, `STUDIO_TRIALS_ENABLED=true`, or `RAZORPAY_TEST_ENABLED=true`.

For isolated hosted verification, run the API image with `NODE_ENV=production` and `SOCIALSTUDIO_DEPLOYMENT=staging`. Set `FRONTEND_URL` to the exact HTTPS staging frontend origin, supply the Clerk development keys and the verified `OWNER_CLERK_USER_ID`, and keep generation and trials disabled. Only the pinned owner can access staging project APIs. TLS verification and MFA for administrator actions apply in staging. For production, omit the staging setting and configure the Clerk production instance. Keep preview and production builds scoped to their respective Clerk credentials and origins.

## Razorpay test mode

Use the owner-designated Razorpay Google account and verify **Test Mode** before changing any settings. From **Account & Settings → API Keys**, obtain approved Test keys and configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the staging secret store. After a verified staging API is reachable over HTTPS, configure `POST /api/billing/test/webhook` in the Razorpay test dashboard with the `payment.captured` and `refund.processed` events. Use a separate strong `RAZORPAY_WEBHOOK_SECRET` and set the intended `RAZORPAY_TEST_PLAN_PAISA` and `RAZORPAY_TEST_PLAN_CREDITS`. Set `RAZORPAY_TEST_ENABLED=true` only for the test environment. Raw-body signature verification, canonical payment lookup, and credit settlement run on the backend. The Account page shows the test checkout when enabled. [Razorpay checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps) · [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/)

If dispute events are available in the test dashboard, subscribe to `payment.dispute.created`, `payment.dispute.under_review`, `payment.dispute.action_required`, `payment.dispute.won`, `payment.dispute.lost`, and `payment.dispute.closed`. The backend reads the canonical payment and dispute. Pending disputes hold the disputed portion of test credits. The final amount deducted by Razorpay determines any continuing hold. Reversals, refunds, and duplicate deliveries update the isolated test wallet transactionally. [Razorpay dispute webhook events](https://d6xcmfyh68wv8.cloudfront.net/docs/webhooks/payloads/disputes/)

## Hosted execution

The API accepts owner-scoped job submissions at `POST /api/pipeline/jobs` and returns an ID for `GET /api/pipeline/jobs/:id`. Supply an `Idempotency-Key` for each submission and reuse it for transport retries. Manual import can validate and save a visual plan before credit-consuming preview or export. The worker reloads the exact project revision and retrieves its saved narration from private storage.

Use the same MongoDB replica set, Redis URL, private media configuration, and job quote configuration in the API and workers. Run `npm run worker:studio` for provider generation and `npm run worker:render` for stills, motion previews, and exports. Each worker dispatches and claims only its assigned operations and runs one job at a time. The workers use MongoDB account status and do not require Clerk credentials. Give provider keys to the generation worker. Use a distinct host or container for rendering.

The Dockerfile defaults to the `api` image. Build the other images with `docker build --target generation -t socialstudio-generation .` and `docker build --target renderer -t socialstudio-renderer .`. The renderer target installs Chromium dependencies and prebundles the composition. Keep `STUDIO_GENERATION_ENABLED=false` on the public deployment. Verify `/health`, `/ready`, an anonymous account request, process memory, and `SIGTERM` on the intended Linux host before exposing staging. Use `REDIS_HEALTH_CHECK=true` to verify managed Key Value readiness even with generation disabled.

For isolated staging only, `STUDIO_GENERATION_CONFIG` is a JSON object with `caps` and `operations`. Caps are `dailyMicros`, `monthlyMicros`, `userDailyMicros`, `providerDailyMicros`, and optional `trialDailyMicros`. An operation specifies a credit price, a compute reservation, and provider attempt ceilings. This example enables only a small isolated render test:

```json
{
  "caps": {"dailyMicros": 10000, "monthlyMicros": 50000, "userDailyMicros": 5000, "providerDailyMicros": 4000},
  "operations": {"render": {"credits": 3, "computeMicros": 50, "providers": {}}}
}
```

Use one billing currency for the configured ceilings and rates. One micro is one millionth of that currency. Set limits against the deployed model, prompt and output bounds, input length, provider billing floors, and currency conversion where relevant. Supported operation keys are `script`, `refine`, `audio`, `visuals`, `stills`, `motion`, and `render`. For example, a Groq quote accepts `{"attempts":2,"microsPerCall":10000,"microsPerMillionUnits":{"inputTokens":150000,"outputTokens":600000}}`. Use rates that correspond to the selected model and currency. The worker uses reported counters when it can price the full request and uses the reserved per-call ceiling otherwise. This is an estimate until reconciled against provider records. Keep optional paid illustration off.

An MFA-verified owner can pause admissions and new provider calls, allocate expiring credit grants, and inspect usage under **Account → Owner controls**. The optional `STUDIO_CREDIT_PLANS` JSON array accepts `id`, `name`, `credits`, and `expiresInDays` for each owner allocation plan. When a transport outcome is ambiguous, use the provider’s billing record before posting spending and an audit reference to `POST /api/admin/generation/jobs/:id/reconcile`. The request body is `{"reference":"invoice-reference","spending":{"groq":123}}` with integer micro-units.

Keep `STUDIO_TRIALS_ENABLED=false`. An isolated test can enable claims with `STUDIO_TRIALS_CONFIG` containing `credits`, `validDays`, `claimsPerDay`, and `eligibleClerkIds`, and with a positive `trialDailyMicros` generation cap. Claims require an authenticated eligible member, are limited to one per account and canonical email, and carry the trial budget cap when spent.

## Release order

1. Verify the intended owner with the Clerk development keys and recent MFA. Verify the scoped Atlas connection and migrate only reviewed owner projects.
2. Start the existing API image in isolated Linux staging and verify managed Redis, graceful termination, and memory headroom. Verify the two workers independently and keep generation private.
3. Verify signed-in Cloudinary playback and public guest playback in the staging Studio. Verify test-mode Razorpay checkout and webhooks once the staging API is reachable.
4. Complete the bounded saved-project live Groq test and verify its generated MP4. Review spend and optimize render capacity on the intended host before reconsidering public paid generation.
