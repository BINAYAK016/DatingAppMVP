# Authentication setup and verification

Sangai keeps the existing email/password sessions, native SecureStore, provider identities and five saved profile steps. Email signup creates a restricted account: it cannot enter protected dating/social APIs until email verification, an adult declaration and completed onboarding. Verified Google accounts skip email OTP and follow the same adult/profile gates. Completed existing accounts enter Discover. Existing password accounts are never silently linked to Google by email alone.

## Local setup

Create the ignored root `.env` from `.env.example`. Generate a random `OTP_HASH_SECRET` with at least 32 characters; use a secret manager for deployment. This Node command creates/preserves local configuration and never prints the secret:

```powershell
node -e "const fs=require('fs'),c=require('crypto');let s=fs.existsSync('.env')?fs.readFileSync('.env','utf8'):fs.readFileSync('.env.example','utf8');if(!/^OTP_HASH_SECRET=.{32,}$/m.test(s)){const line='OTP_HASH_SECRET='+c.randomBytes(32).toString('hex');s=/^OTP_HASH_SECRET=/m.test(s)?s.replace(/^OTP_HASH_SECRET=.*$/m,line):s+'\n'+line+'\n';fs.writeFileSync('.env',s);}"
docker compose up --build -d
```

Mailpit at `http://localhost:8025` captures local verification/reset email. It does **not** deliver to external inboxes. The app sends a verification email automatically on the verification screen, accepts a six-digit code with paste/autofill, shows resend timing, and reports invalid, expired or exhausted codes inline. No code is returned by an API or shown as a development shortcut in the app.

## OTP behavior

- Cryptographically random six-digit codes expire after 15 minutes and work once. HMAC hashes bind codes to their challenge, account and purpose. The server-only secret never enters the mobile bundle, responses or logs.
- Each code permits five attempts; each account/purpose permits 20 attempts per hour, five code issuances per hour and 15 per day. Resending is limited to once per minute. IP limits separately bound verification and issuance requests. These process-local IP counters suit the current single-instance beta; they are not distributed production throttling.
- SMTP runs outside the shared database mutation lock. Pending codes cannot redeem; failed delivery removes its pending challenge and preserves an older usable code. Successful resend invalidates older codes. Cooldown responses contain timestamps, never a code, and do not claim another email was sent.
- Existing opaque challenges remain redeemable server-side until expiry or consumption; use Resend for a new six-digit code in the updated app. Rotating `OTP_HASH_SECRET` invalidates outstanding new OTPs; it does not invalidate existing login sessions.
- Password recovery returns the same message and response shape for unknown and known addresses. Password reset is single-use and removes existing sessions. Delivery failure is not disclosed in the public recovery response; operators must monitor their SMTP provider.

## Real SMTP at deployment

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` in server secrets. `SMTP_SECURE=true` uses immediate TLS (commonly port 465); false requires STARTTLS for external hosts (commonly 587). Local Mailpit/loopback testing is exempt. Use a verified sender/domain and the provider’s required SPF/DKIM/DMARC setup. Port choices must match the provider. Keep `OTP_HASH_SECRET` stable across server restarts and private from clients. Recreate the API container after changes. See [Nodemailer SMTP options](https://nodemailer.com/smtp).

The latest user decision defers SMTP credentials until deployment. External delivery remains unverified. Do not call Mailpit evidence real inbox delivery. Before inviting real testers, verify delivery, spam placement, sender branding, resend, wrong/expired codes and password reset against an authorized real mailbox. HTTPS and reviewed deployment settings remain necessary; this beta still refuses `NODE_ENV=production`.

## Google on Android and iOS

1. Configure the OAuth consent screen in Google Cloud, including app branding and approved test users while the app is in Testing.
2. Create a **Web** OAuth client. Set its public ID in server `GOOGLE_CLIENT_ID` and mobile `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. They must match. No client secret is needed for this ID-token flow, and none belongs in the app.
3. Create an **Android** client for `com.sangai.beta` and the SHA-1 of the certificate that actually signs the installed APK. Debug, local release, EAS and Play App Signing certificates can differ. Register the ones used for testing/distribution. The app uses the installed native Google Sign-In adapter; it requires Google Play Services.
4. Create an **iOS** client for `com.sangai.beta`. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `app.config.ts` derives the reversed client-ID URL scheme through the existing config plugin.
5. Rebuild native applications after client IDs/native configuration change. Expo Go cannot run this native Google module. Test Android and iOS separately.

The native Google button uses the library’s official treatment and handles cancellation without creating an account, and reports pending connection, missing tokens, unavailable Play Services and server errors. Client availability is checked against `/v1/auth/config`; configuration flags do not establish provider correctness. Backend Google tokens are validated for audience, expiry/signature and verified email, and linked by Google subject. Do not weaken the password-account conflict guard to make a test pass.

## Google on the supplementary web preview

The web adapter loads the official Google Identity Services SDK, renders its **Continue with Google** button, and exchanges its ID token with the same `/v1/auth/google` endpoint. Register the exact web origin in the Web OAuth client (for example `http://localhost:8081` during local testing). For an approved hosted preview, configure its HTTPS origin both in Google and server `CORS_ORIGINS` (comma-separated exact origins). Never use a wildcard. The callback flow uses a token exchange, not an OAuth redirect route; no redirect URI or new auth service is introduced.

Only public IDs may use `EXPO_PUBLIC_` variables. Missing configuration is visibly unavailable; script/network failures offer Retry. The app disables automatic Google account selection; cancellation does not create a Sangai account.

## Verification and limits

Focused isolated API tests cover delivery format, hashes/no code exposure, cooldown and replacement, concurrent consumption, expiry, attempt/issuance caps, pending-code rejection, SMTP lock isolation, failed delivery, recovery uniformity and reset/session invalidation. Browser tests exercise actual local Mailpit signup/verification, profile completion, logout/existing-user login, input validation and session recovery after a failed state request.

Google OAuth credentials are not configured on this host. Real Google provider sign-in and external SMTP are **not yet verified end-to-end**. Mocked responses, invalid-token rejection or a compiled adapter do not count as provider verification.

References: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [native Google Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo), [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/overview).
