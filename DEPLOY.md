# Deploying HackFest API to Vercel

## Folder structure expected by Vercel

```
hackfest-api/
  api/
    index.js        ← Express app (exported, not listening)
  vercel.json       ← Routes all /api/* to api/index.js
  package.json
  .env.example
  schema.sql
```

---

## Step 1 — Push to GitHub

```bash
cd hackfest-api
git init
git add .
git commit -m "initial"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/hackfest-api.git
git push -u origin main
```

---

## Step 2 — Import to Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository** → select `hackfest-api`
3. Framework Preset: **Other**
4. Root Directory: leave blank (`.`)
5. Click **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/hackfest?sslmode=require` |

6. Click **Deploy**

Vercel will give you a URL like:
```
https://hackfest-api-xyz.vercel.app
```

---

## Step 3 — Test the deployment

```bash
curl https://hackfest-api-xyz.vercel.app/api/health
# → {"status":"ok","db":"connected","time":"..."}
```

---

## Step 4 — Connect the frontend

Open the React app → Setup screen → paste your Vercel URL:
```
https://hackfest-api-xyz.vercel.app
```

---

## CORS

If your frontend is on a specific domain (e.g. deployed on Vercel too),
add a second env var in Vercel dashboard:

| Key | Value |
|-----|-------|
| `ALLOWED_ORIGIN` | `https://your-frontend.vercel.app` |

For local development, `*` is used by default.

---

## Local development (still works)

```bash
cp .env.example .env
# fill in DATABASE_URL
npm install
npm run dev
# → API running on http://localhost:3001
```
