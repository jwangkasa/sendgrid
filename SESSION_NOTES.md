# Session Summary — Bulk Email Engine

## What We Built

A full-stack Next.js 15 application deployed on Vercel that sends personalised bulk email campaigns via SendGrid, reads vendor data from SAP HANA Cloud, authenticates via Firebase, and tracks delivery metrics in real time.

---

## Architecture

```
Browser (Next.js)
  ├── /login          Firebase Auth (Google + Email/Password)
  ├── /campaign       Upload Excel → compose template → preview → dispatch
  ├── /vendors        SAP HANA vendor table → select → launch campaign
  └── /dashboard      Real-time delivery metrics (polls every 3s)

Server (Next.js API Routes on Vercel)
  ├── /api/campaign/dispatch    INSERT to HANA + send via SendGrid
  ├── /api/campaign/metrics     Query HANA RECIPIENT_LOGS
  ├── /api/campaign/batches     List all campaigns
  ├── /api/vendors              HANA VENDOR table (paginated + filtered)
  ├── /api/vendors/filters      Distinct category/industry values
  └── /api/webhooks/sendgrid    Receive delivery events → update HANA

Data Layer
  ├── SAP HANA Cloud   RECIPIENT_LOGS, HATCH.VENDOR tables
  └── Firebase         Auth (allowedUsers allowlist) + Firestore (campaign docs)
```

---

## Key Problems Solved & Lessons Learned

### 1. SendGrid `{{TOKEN}}` not substituting in emails
- **Root cause:** SendGrid's `substitutions` map in v3 non-template API is unreliable
- **Fix:** Interpolate HTML/text body server-side per recipient before sending
- **Lesson:** Never rely on SendGrid client-side substitution for non-dynamic-template sends

### 2. SendGrid `custom_args` not appearing in webhook events
- **Root cause 1:** `custom_args` set at personalization level — not propagated to webhooks
- **Root cause 2:** SendGrid Node.js SDK silently drops `customArgs` (excludes it from `toSnakeCase` conversion)
- **Root cause 3:** `batch_id` arrives at the **top level** of the webhook event object, not inside `custom_args`
- **Fix:** Bypass the SDK entirely with raw `fetch`, use all snake_case keys, read `event.batch_id` directly
- **Lesson:** When using SendGrid webhooks, always log `JSON.stringify(events[0])` first to see the exact payload shape

### 3. Firebase Auth COOP warning on Vercel
- **Root cause:** Vercel sets strict `Cross-Origin-Opener-Policy: same-origin` header; `signInWithPopup` triggers `window.close()` which is blocked
- **Fix:** Switched to `signInWithRedirect` + `getRedirectResult`
- **Lesson:** On Vercel, always use redirect-based Firebase Auth

### 4. TypeScript build errors blocking Vercel deploys
- `convertPublicKeyToECDH` → should be `convertPublicKeyToECDSA`
- `hdb` module has no types → use `const hdb: any = require('hdb')`
- SendGrid `content` array type requires `MailContent[] & { 0: MailContent }` → cast via `unknown`
- **Lesson:** Always run `npm run build` locally before pushing — catches these before CI

### 5. `useSearchParams()` missing Suspense boundary
- **Root cause:** Next.js 15 requires `useSearchParams` to be inside `<Suspense>`
- **Fix:** Split page into inner component + default export wrapper with `<Suspense>`
- **Lesson:** Any Next.js App Router page using `useSearchParams` with dynamic reads needs Suspense

### 6. Duplicate file content causing TypeScript errors
- **Root cause:** Edit tool appended new content instead of replacing, creating duplicate exports
- **Fix:** Used Write tool to completely rewrite the file
- **Lesson:** When a file has duplicate declarations, always use Write (full rewrite) not Edit

### 7. SAP BTP SSO blocking CI/CD pipeline credentials
- **Root cause:** BTP accounts with SSO can't use username/password auth
- **Fix:** Use `cf8 login --sso` locally; for CI need a technical user without SSO
- **Lesson:** Check SSO policy before designing CI/CD pipelines for BTP

---

## Deployment Flow

```
Local dev  →  git push main  →  Vercel auto-deploys
                             →  GitHub Actions CI (type-check + build)
```

Production release:
```bash
npm version patch   # bumps version + creates git tag
git push --follow-tags   # triggers deploy-production job (requires approval)
```

---

## Migrations Run on HANA

```sql
-- 001: Create RECIPIENT_LOGS table + indexes
-- 002: Add LAST_MODIFIED to VENDOR table
-- 003: Add CAMPAIGN_NAME column to RECIPIENT_LOGS
ALTER TABLE RECIPIENT_LOGS ADD ("CAMPAIGN_NAME" NVARCHAR(200));
```

---

## Prompting Suggestions for Future Sessions

### Be specific about the layer
Instead of: *"fix the dashboard"*
Say: *"the `/api/campaign/metrics` route returns empty rows — here's the SQL result and the Vercel log"*

### Paste the exact error
The fastest path to a fix is the full error message + stack trace + relevant log line. Summaries lose detail.

### State what you already tried
*"I already checked X and Y, the issue is Z"* — avoids re-treading ground and saves tokens.

### Confirm before large rewrites
For files >200 lines, ask *"what's your plan before you change this?"* — catches wrong assumptions early.

### One concern per message
Mixing *"fix the bug AND add a feature AND deploy"* in one message leads to partial fixes. Sequence them.

---

## Token & Response Efficiency Tips

| Tip | Why it helps |
|---|---|
| Paste only the relevant log lines, not the full Vercel output | Reduces context noise |
| Share HANA query results as text, not screenshots | Claude can't read table data from images reliably |
| Say *"just the code change, no explanation"* when iterating fast | Cuts response length in half |
| Use `npm run build` locally first | Catches 80% of errors before they reach CI, saves 2-3 round trips |
| When debugging, add one `console.log` at a time | Isolates the variable faster than logging everything |
| Reference file paths and line numbers | *"line 53 of webhooks/route.ts"* is faster than describing the code |
| Say *"push to GitHub"* only when ready | Avoids CI failures from incremental half-fixes |

---

## Environment Variables (Vercel)

| Variable | Purpose |
|---|---|
| `HANA_HOST` | SAP HANA Cloud hostname |
| `HANA_PORT` | `443` |
| `HANA_USER` | Database user |
| `HANA_PASSWORD` | Database password |
| `HANA_SCHEMA` | `HATCH` |
| `SENDGRID_API_KEY` | SendGrid API key (`SG.xxx`) |
| `SENDGRID_FROM_EMAIL` | Sender email address |
| `SENDGRID_FROM_NAME` | Sender display name |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | From SendGrid → Mail Settings → Event Webhook |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |
| `NEXT_PUBLIC_APP_URL` | Deployed Vercel URL |

---

## Adding Allowed Users

**Firebase Console → Authentication → Users → Add user**
- Set email + password

**Firebase Console → Firestore → allowedUsers → Add document**
- Document ID = email (lowercase)
- Field: `email` = email address

Both steps required — Auth holds credentials, Firestore controls access.
