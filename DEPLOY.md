# Deploying ProspectIQ to Vercel

## Prerequisites

- A [Vercel](https://vercel.com) account (free tier works)
- Your GitHub repo pushed to origin
- All external service accounts created (Supabase, Brevo, Groq, Upstash)

---

## Step 1 — Import Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. **Framework Preset:** Next.js (auto-detected)
4. **Build Command:** `next build` (default)
5. **Output Directory:** `.next` (default)
6. **Install Command:** `npm install` (default)
7. **Node.js Version:** 18.x or 20.x

---

## Step 2 — Environment Variables

Add **all** of the following in Vercel → Project Settings → Environment Variables.

### Required for All Environments

| Variable | Where to Get It | Example |
|----------|----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (⚠️ secret) | `eyJhbGciOi...` |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Your verified sender email in Brevo | `outreach@yourdomain.com` |
| `GROQ_API_KEY` | Groq Console → API Keys | `gsk_...` |
| `QSTASH_TOKEN` | Upstash Console → QStash → Details | `eyJ...` |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash Console → QStash → Signing Keys | `sig_...` |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash Console → QStash → Signing Keys | `sig_...` |
| `DAILY_SEND_LIMIT` | Brevo free tier = 300 | `300` |
| `CAMPAIGN_INTERNAL_SECRET` | Generate: `openssl rand -hex 32` | `a1b2c3...` |

### Optional (Auto-Detected)

| Variable | Notes |
|----------|-------|
| `VERCEL_URL` | ✅ Auto-set by Vercel (e.g., `your-app-abc123.vercel.app`) |
| `NEXT_PUBLIC_APP_URL` | Override for custom domain (e.g., `https://prospectiq.yourdomain.com`) |
| `NEXT_PUBLIC_SITE_URL` | Same as APP_URL — used for OpenGraph tags |

> **⚠️ IMPORTANT:** Do NOT prefix server-only secrets with `NEXT_PUBLIC_`.
> Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`,
> and `NEXT_PUBLIC_SITE_URL` should be public. All others are server-side only.

---

## Step 3 — Supabase Configuration

In your Supabase dashboard:

1. **Authentication → URL Configuration:**
   - **Site URL:** `https://your-app.vercel.app`
   - **Redirect URLs:** Add `https://your-app.vercel.app/auth/callback`

2. **Authentication → Providers → Google** (if using Google OAuth):
   - Update the redirect URI to `https://your-app.vercel.app/auth/callback`

3. Ensure all database tables and RLS policies are set up per `supabase/schema.sql`.

---

## Step 4 — Deploy

Click **Deploy** in Vercel. The build should complete in ~30 seconds.

### Verify Deployment

1. Visit your Vercel URL
2. You should see the login page
3. Sign up / log in via email or Google
4. Verify the dashboard loads with live data
5. Try importing a prospect, creating a campaign

---

## Step 5 — Custom Domain (Optional)

1. Vercel → Project Settings → Domains
2. Add your custom domain
3. Update `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` env vars
4. Update Supabase redirect URLs to match

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Invalid API key" errors | Double-check env vars are set in Vercel (not just locally) |
| Auth redirect loops | Ensure Supabase Site URL and Redirect URLs match your Vercel domain |
| Campaign emails fail | Verify `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` are correct |
| QStash scheduling fails | Check `QSTASH_TOKEN` and signing keys |
| 500 errors on dashboard | Check `SUPABASE_SERVICE_ROLE_KEY` is set (server-side only) |
| Build fails | Run `npm run build` locally first to see errors |
