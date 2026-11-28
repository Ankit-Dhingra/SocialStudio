# SocialStudio owner setup

The SocialStudio Clerk development instance has Google sign-in enabled. The Clerk Backend API verified the configured owner email and the verified linked Google identity against the pinned Clerk ID. SocialStudio persisted the active owner in the isolated local MongoDB.

The official Clerk CLI configured `CLERK_SECRET_KEY` in the ignored local `.env.socialstudio-clerk.local` file after matching the development instance. The isolated test setup uses frontend port `5179`, backend port `4017`, and MongoDB port `27029`. Keep the backend key out of chat, Git, and frontend configuration.

Use this command for the local backend while the isolated MongoDB process is running.

```powershell
node --env-file=.env.socialstudio-clerk.local --import tsx src/api.ts
```

The real Google browser session returned `owner` from `GET /api/account`, and Clerk confirmed the owner’s MFA enrollment. The local environment uses `OWNER_REQUIRE_MFA=true`. The admin request returned 403 before recent MFA and 200 after a fresh Google sign-in with the authenticator challenge. To repeat the verification, sign out of Studio, sign back in with Google, finish the second factor, and open **Account**. `GET /api/admin/access` requires MFA verified within the last 15 minutes in production. Clerk allows MFA testing in development and requires a paid Clerk plan for production MFA. [Clerk environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables) · [Clerk MFA](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#multi-factor-authentication)
