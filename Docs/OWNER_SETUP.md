# SocialStudio owner setup

The SocialStudio Clerk development instance has Google sign-in enabled. The authorized owner has already signed in through Google in the browser. Development verification still needs the backend to read the verified Clerk profile and persist the owner record in MongoDB.

1. In the Clerk dashboard, select **SocialStudio**, keep **Development** selected, and open **Developer → API keys**.
2. Use the copy control beside the default development secret key. Add the value as `CLERK_SECRET_KEY` in the ignored local `.env.socialstudio-clerk.local` file. Keep the secret in that file and out of chat, Git, and frontend configuration.
3. The isolated test setup uses frontend port `5179`, backend port `4017`, and MongoDB port `27029`. The configuration already identifies the verified owner email and pins its development Clerk user ID.

Use this command for the local backend while the isolated MongoDB process is running.

```powershell
node --env-file=.env.socialstudio-clerk.local --import tsx src/api.ts
```

`GET /api/account` should report `owner` for the authorized Google account after initial provisioning. Administrative routes also require recent MFA in production. The development instance can exercise that same requirement by setting `OWNER_REQUIRE_MFA=true` after the owner has enrolled a second factor. The public frontend uses `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL` for the selected environment. [Clerk environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables)
