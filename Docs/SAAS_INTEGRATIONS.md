# SocialStudio staging integrations

The local creator workflow and the currently running Render deployment are independent of this branch. Use staging credentials and leave public paid generation, live payments, and free trials disabled.

## Clerk and Atlas

Complete the development Clerk steps in [Set up the Studio owner](OWNER_SETUP.md). Begin with the local MongoDB URL already configured for the owner check.

Atlas now has `socialstudio.users` in the existing free `Cluster0` in the DevTinder project. In **Database & Network Access → Database Users → Add New Database User**, create a dedicated `socialstudio_app` password user. Under **Specific Privileges**, grant `readWrite` on the `socialstudio` database. Restrict the user to `Cluster0` if the dashboard offers resource restriction. Keep the generated password in a password manager or the deployment secret store. Open **Cluster0 → Connect → Drivers** and configure `MONGODB_URI` with `/socialstudio` as the database and the scoped credentials. URL-encode the password if needed. Add only an explicitly approved deployment IP range if the existing access list does not permit the connection. [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)

In Clerk, open **SocialStudio → Development → Developers → API keys** and set the default secret as `CLERK_SECRET_KEY` in the ignored `.env.socialstudio-clerk.local`. Keep the value in the local secret file or the staging secret store. Verify the signed-in Google account on `GET /api/account`, pin its Clerk ID as `OWNER_CLERK_USER_ID`, set up a second factor, and confirm `GET /api/admin/access` with a recent factor before moving to Atlas.

Once the application has provisioned the verified owner, run the migration with explicitly selected `session_…` identifiers. Review the dry run first. The migration creates missing records, preserves existing records and original files, and never resumes interrupted legacy generation.

```powershell
node --env-file=.env.socialstudio-clerk.local --import tsx scripts/migrate-owner-projects.ts session_UPDATE_ME
node --env-file=.env.socialstudio-clerk.local --import tsx scripts/migrate-owner-projects.ts --apply --copy-media session_UPDATE_ME
```

Omit `--copy-media` when migrating metadata only. Check the reported media count against the selected project before switching its delivery path. Media references whose source files are missing are left unavailable. Production rejects MongoDB connections that disable TLS or certificate and hostname verification.

## Cloudflare R2

1. Open **Cloudflare Dashboard → R2 Object Storage**. Review the subscription screen. It listed $0 due on activation and possible monthly usage charges. The account holder must approve and complete this activation.
2. Create two buckets, `socialstudio-private` and `socialstudio-demo`. Keep the private bucket off public URLs and public custom domains. Create bucket-scoped Object Read and Write S3 credentials for the private bucket and store the account ID, access key ID, and secret in the backend environment.
3. Set `PRIVATE_MEDIA_DRIVER=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PRIVATE_BUCKET`, and `R2_DEMO_BUCKET`. The application signs authorized private reads for 15 minutes. Use `PRIVATE_MEDIA_DRIVER=local` and a strong `PRIVATE_MEDIA_SIGNING_KEY` for local testing.
4. Run `npm run demo:prepare`. Upload the five MP4s and five JPEGs from the staging directory to the demo bucket under their existing names. Connect a dedicated public custom domain to the demo bucket and use its HTTPS origin or prefix as `DEMO_PUBLIC_BASE_URL`. A production custom domain avoids the managed `r2.dev` development URL's rate limits.
5. Add an object expiration rule matching only `tmp-` on the private bucket. The local equivalent is `npm run media:cleanup`, which only removes expired local `tmp-` objects. Confirm the expiration time against the worker retry window before applying the cloud rule.

[Cloudflare S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/) · [Public bucket access](https://developers.cloudflare.com/r2/buckets/public-buckets/) · [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

## Render Key Value

The `socialstudio-queue` instance is in the existing SocialStudio workspace, Production environment, and Virginia region. The selected Free plan is $0 per month, 25 MB of RAM, with persistence off and `noeviction`. External access was disabled in the dashboard. When the updated backend is ready to roll out, copy the instance's internal connection URL into the backend `REDIS_URL` environment variable and optionally set `REDIS_HEALTH_CHECK=true`. The owner-only `/api/admin/redis-health` endpoint reports the cached connectivity result. Existing backend uptime monitoring continues to use `/health`. [Render Key Value](https://render.com/docs/key-value)

Render's failed November 14 deploy at `7a42314` recorded an application runtime exit with status 1. The deploy page no longer contains the detailed logs. The seven-day Hobby retention period had passed at inspection, so the failing exception is unavailable. The older running deployment was left in place. [Failed deploy](https://dashboard.render.com/web/srv-dbq93doae00c73ab8lt0/deploys/dep-dbsa5m6417fc73fa4oa0) · [Render log retention](https://render.com/docs/logging#retention-period)

## Razorpay test mode

Sign in to the existing Razorpay account and switch the dashboard to **Test Mode**. From **Account & Settings → API Keys**, generate Test keys and store the `rzp_test_…` key ID and secret in `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. After a verified staging API is reachable over HTTPS, configure `POST /api/billing/test/webhook` in the Razorpay test dashboard with the `payment.captured` and `refund.processed` events. Use a separate strong `RAZORPAY_WEBHOOK_SECRET` and set the intended `RAZORPAY_TEST_PLAN_PAISA` and `RAZORPAY_TEST_PLAN_CREDITS`. Set `RAZORPAY_TEST_ENABLED=true` only for the test environment. Raw-body signature verification, canonical payment lookup, and credit settlement run on the backend. The Account page shows the test checkout when enabled. [Razorpay checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps) · [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/)

If dispute events are available in the test dashboard, subscribe to `payment.dispute.created`, `payment.dispute.under_review`, `payment.dispute.action_required`, `payment.dispute.won`, `payment.dispute.lost`, and `payment.dispute.closed`. The backend reads the canonical payment and dispute. Pending disputes hold the disputed portion of test credits. The final amount deducted by Razorpay determines any continuing hold. Reversals, refunds, and duplicate deliveries update the isolated test wallet transactionally. [Razorpay dispute webhook events](https://d6xcmfyh68wv8.cloudfront.net/docs/webhooks/payloads/disputes/)

## Hosted execution

The API accepts owner-scoped job submissions at `POST /api/pipeline/jobs` and returns an ID for `GET /api/pipeline/jobs/:id`. Supply an `Idempotency-Key` for each submission and reuse it for transport retries. Manual import can validate and save a visual plan before credit-consuming preview or export. The worker reloads the exact project revision and retrieves its saved narration from private storage.

Use the same MongoDB replica set, Redis URL, private media configuration, and job quote configuration in the web service and the dedicated `npm run worker:studio` process. Keep `STUDIO_GENERATION_ENABLED=false` on the public deployment. The worker runs one job at a time and periodically dispatches committed MongoDB jobs to BullMQ. Run a Render worker separately from the web service. Set the worker’s Node heap and host memory independently of the web image’s API heap.

For isolated staging only, `STUDIO_GENERATION_CONFIG` is a JSON object with `caps` and `operations`. Caps are `dailyMicros`, `monthlyMicros`, `userDailyMicros`, `providerDailyMicros`, and optional `trialDailyMicros`. An operation specifies a credit price, a compute reservation, and provider attempt ceilings. This example enables only a small isolated render test:

```json
{
  "caps": {"dailyMicros": 10000, "monthlyMicros": 50000, "userDailyMicros": 5000, "providerDailyMicros": 4000},
  "operations": {"render": {"credits": 3, "computeMicros": 50, "providers": {}}}
}
```

Use one billing currency for the configured ceilings and rates. One micro is one millionth of that currency. Set limits against the deployed model, prompt and output bounds, input length, provider billing floors, and currency conversion where relevant. Supported operation keys are `script`, `audio`, `visuals`, `stills`, and `render`. For example, a Groq quote accepts `{"attempts":2,"microsPerCall":10000,"microsPerMillionUnits":{"inputTokens":150000,"outputTokens":600000}}`. Use rates that correspond to the selected model and currency. The worker uses reported counters when it can price the full request and uses the reserved per-call ceiling otherwise. This is an estimate until reconciled against provider records. Preserve the strict gate for optional illustration and motion engines while their hosted artifact path is unverified.

An MFA-verified owner can pause admissions and new provider calls, allocate expiring credit grants, and inspect usage under **Account → Owner controls**. The optional `STUDIO_CREDIT_PLANS` JSON array accepts `id`, `name`, `credits`, and `expiresInDays` for each owner allocation plan. When a transport outcome is ambiguous, use the provider’s billing record before posting spending and an audit reference to `POST /api/admin/generation/jobs/:id/reconcile`. The request body is `{"reference":"invoice-reference","spending":{"groq":123}}` with integer micro-units.

Keep `STUDIO_TRIALS_ENABLED=false`. An isolated test can enable claims with `STUDIO_TRIALS_CONFIG` containing `credits`, `validDays`, `claimsPerDay`, and `eligibleClerkIds`, and with a positive `trialDailyMicros` generation cap. Claims require an authenticated eligible member, are limited to one per account and canonical email, and carry the trial budget cap when spent.
