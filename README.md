# Hackaman Hub

A full-stack hackathon feedback management system with a public-facing conference landing page, judge onboarding, scoring tools, and registration management.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| API | Express.js (Node 18) |
| Database | Neon (serverless PostgreSQL) |
| Deployment | Vercel |
| Auth | JWT + OAuth (GitHub / Google / GitLab) |
| Fonts | Inter, IBM Plex Mono |

---

## Project Structure

```
hackfest/
├── api/
│   └── index.js          # Express API — all routes
├── src/
│   ├── main.jsx           # React entry point
│   ├── App.jsx            # Root component + routing + sidebar shell
│   ├── shared.jsx         # Design system, API client, shared hooks
│   ├── pages.jsx          # All admin pages (Dashboard → Registrations)
│   └── PublicPage.jsx     # Public conference landing page
├── schema.sql             # Full database schema (run once on fresh DB)
├── migration_v5.sql       # Migration for CMS tables (run after initial schema)
├── vercel.json            # Vercel deployment config
└── package.json
```

---

## Setup

### 1. Database (Neon)

1. Create a free project at [neon.tech](https://neon.tech)
2. Open the **SQL Editor**
3. Paste and run `schema.sql` — creates all tables and seeds demo data
4. Paste and run `migration_v5.sql` — adds CMS tables for the public page builder

Verify CMS tables exist:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('page_speakers','page_partners','page_team');
-- Should return 3 rows
```

### 2. Environment Variables

In Vercel → Settings → Environment Variables, add:

```env
DATABASE_URL=postgresql://...          # Neon connection string
JWT_SECRET=your-random-secret-here     # generate: openssl rand -hex 32
FRONTEND_URL=https://your-app.vercel.app

# OAuth (optional — each provider needs its own app registration)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
```

### 3. Deploy to Vercel

```bash
npm install
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard for auto-deploy on push.

### 4. Local Development

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL and JWT_SECRET
npm run dev             # starts API on :3001 and Vite on :5173
```


---

## Admin Screens

### Dashboard

The first screen after login. Scoped to whichever hackathon is selected in the sidebar dropdown.

- **Leaderboard** — teams ranked by weighted average score across all judges. Score is computed as `Σ(score/maxScore × weight)` normalised to 10.
- **Recent Activity** — latest feedback submissions with judge name and score.
- **Criteria Weights** — dark panel showing each criterion's percentage weight as a bar.
- **Stats strip** — total teams, judges, feedback submissions, and coverage percentage (feedbacks submitted ÷ possible feedbacks).

---

### Hackathons

List of all events with inline stats per row: team count, feedback coverage bar, criteria count, average score, and current leader.

**Creating a hackathon:**
- Fill in name, tagline, dates, location, prize pool, tracks (comma-separated), and description.
- Set **Banner Color** — this accent color is used throughout the public landing page.
- **Schedule** — one event per line in `Time | Event Name` format. Rendered as a numbered timeline on the public page.
- **FAQ** — Q&A blocks separated by a blank line. Each block starts with `Q:` on one line and `A:` on the next. Rendered as an accordion.
- Toggle **Publish** to make the hackathon visible on its public URL.

**Expanding a row** shows the full team rankings and per-judge coverage grid.

Clicking **Open Dashboard** switches the sidebar context to that hackathon and navigates to the Dashboard page.

---

### Teams

Lists all teams for the active hackathon. Each team has a name, project name, category (AI/ML, Sustainability, Security, etc.), and members (comma-separated names).

Teams can also be created automatically from approved registrations — see the Registrations screen.

---

### Judges

Global judge profiles (not hackathon-scoped). Each judge record holds:
- Name, organization, title/role
- **Photo** — upload a file (JPG/PNG/WebP up to 2MB) or paste a URL. Displayed in the public landing page judge grid with a colored initial avatar as fallback.

Judges are linked to user accounts via the **Link to Judge Record** field in User Management.

---

### Criteria

Evaluation criteria for the active hackathon. Each criterion has:
- Name and description
- Max score (usually 10)
- Weight % — must sum to 100% across all criteria

Default criteria follow the standard hackathon rubric:
| Criterion | Weight |
|-----------|--------|
| Innovation & Creativity | 30% |
| Technical Implementation | 25% |
| Impact & Use Case | 20% |
| UI/UX & Design | 15% |
| Demo Quality | 10% |

> Criteria are admin-only. Judges cannot see or modify this screen.

---

### Submit Feedback

The primary judging screen. Available to both admins and judges.

**Fields:**
| Field | Notes |
|-------|-------|
| Team | Dropdown of all teams in the active hackathon |
| Judge | Locked to the logged-in judge's profile; admins see a dropdown |
| Submission Project Number | Free text (e.g. SUB-001) |
| Demo Video Link | URL or NA |
| GitHub Repository | URL |
| Live Project Link | URL or NA |
| PPTs & Photos | Drive link or NA |
| Scoring sliders | One per criterion — click quick-pick buttons (0/2/4/6/8/10) or drag slider |
| Comments | Per-criterion text field for detailed feedback |
| Overall Summary | Free-text summary shown in reports |

A **Score Preview** panel on the right shows the live weighted score as scores are adjusted. Color coding: green ≥ 8, blue ≥ 6, amber ≥ 4, red below 4.

If feedback already exists for the selected team+judge combination, it loads for editing and shows the last-saved timestamp.

---

### All Feedback

Read-only view of all submitted feedback for the active hackathon. Filter by team and/or judge using the dropdowns.

Each card shows:
- Team name, project, category chip
- Judge name, org, submission timestamp
- Clickable links for demo video, GitHub repo, and live project
- Per-criterion score bars with comments
- Overall summary quote

Judges only see their own submissions. Admins see all. Admins can delete individual feedback entries.

---

### Reports

Detailed scorecard for a single team. Select a team from the dropdown (pre-sorted by score, highest first).

Shows:
- Team header with average score and judge count
- **Criteria Breakdown** — grid of per-criterion average scores with color-coded bars
- **Judge Reviews** — full review from each judge including individual criterion scores, links, and overall comment
- **Full Rankings** — complete ordered list of all teams with score bars, the selected team highlighted in blue

Print button triggers `window.print()` for PDF export.

---

### User Management

Manage login accounts and permissions for judges.

**Left panel** — lists admins and judges. Click any user to open their detail panel.

**Detail panel:**

*Hackathon Assignments* — each hackathon card shows Assign/Remove. Judges can only score teams in assigned hackathons. Without an assignment, a judge cannot access any hackathon data.

*Additional Page Access* — by default judges only see Submit Feedback. Admins can grant access per hackathon to:
- Dashboard (read-only view)
- Reports (scorecard view)
- All Feedback (read all submissions)

**Creating a user:**
- Set name, email, password, role (Admin or Judge)
- For judge role: select **Link to Judge Record** — this connects the login to a judge profile so the judge's name auto-fills in the feedback form

> Tip: Instead of creating users manually, approve a judge registration and click **＋ Add to Judges** — this creates both the judge profile and the user login in one step, and shows the temporary password in a toast.

---

### Page CMS

The content editor for the public hackathon landing page. Scoped to the active hackathon.

**Tabs:**

| Tab | What it controls |
|-----|-----------------|
| Content & Settings | Tagline, prize pool, accent color, tracks, about text, prizes, FAQ |
| KeyNotes | Keynote speaker cards (photo, title, org, bio, social links) |
| Session Chairs | Session chair cards (same fields) |
| Org Team | Organizing committee member cards |
| Partners | Sponsor/partner logos with tier (Platinum → Gold → Silver → Bronze → Media → General) |

**Photo uploads** — click the photo circle on any person card to upload a file or paste an image URL. Photos are stored as base64 or URL and displayed on the public page.

**Publishing** — use the **Publish** toggle at the top. Once published, a shareable URL appears with Copy and Preview buttons.

---

### Registrations

Manages incoming applications from the public landing page.

**Workflow:**
1. Applicant fills out the registration form on the public page
2. Application appears here as **Pending**
3. Admin reviews and clicks **Approve** or **Reject**
4. For approved applicants: click **＋ Add to Teams** or **＋ Add to Judges**
   - Teams: creates a team record in the Teams table (fill in project details afterwards)
   - Judges: creates a judge profile AND a user login in one step — temporary password shown in toast and copied to clipboard

Filter tabs: All / Pending / Approved / Rejected with counts.

---

## Public Landing Page

Each published hackathon gets a public URL:
```
https://your-app.vercel.app/register/{hackathonId}
```

Share this link for registrations. The page includes:

| Section | Content |
|---------|---------|
| **Hero** | Event name, tagline, date/location/prize badges, live countdown timer, Register CTA |
| **Stats Strip** | Prize pool, track count, keynote count, judge count |
| **About** | Long-form description + event detail grid |
| **Tracks** | Colored icon cards per track |
| **KeyNotes** | Speaker grid with photos, bios, social links |
| **Session Chairs** | Same as keynotes, separate section |
| **Judges** | Panel grid sourced from assigned judges in the system |
| **Team** | Organizing committee grid |
| **Partners** | Tiered sponsor logos (Platinum largest → General smallest) |
| **Prizes** | Medal cards parsed from prize text |
| **FAQ** | Expandable accordion |
| **Register** | Team/Judge toggle form → creates a registration record |

The sticky navbar highlights the active section as you scroll. The accent color set in Page CMS controls the hero gradient and all highlight colors.

---

## OAuth Setup

### GitHub
1. Go to github.com → Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: `https://your-app.vercel.app`
3. Callback URL: `https://your-app.vercel.app/api/auth/github/callback`
4. Copy Client ID and Client Secret to Vercel env vars

### Google
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client
2. Authorized redirect URI: `https://your-app.vercel.app/api/auth/google/callback`
3. Copy Client ID and Client Secret

### GitLab
1. Go to gitlab.com → Profile → Applications → New application
2. Redirect URI: `https://your-app.vercel.app/api/auth/gitlab/callback`
3. Scopes: `read_user email`

OAuth users are created with the `judge` role by default. Admins can change the role and link to a judge profile in User Management.

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `hackathons` | Events with dates, location, publish state, CMS content |
| `judges` | Judge profiles with avatar and social links |
| `teams` | Teams scoped to a hackathon |
| `criteria` | Scoring criteria with weights, scoped to a hackathon |
| `feedbacks` | Scored submissions linking team + judge + hackathon |
| `users` | Login accounts (email/password or OAuth) |
| `hackathon_judges` | Many-to-many: which judges are assigned to which hackathons |
| `user_permissions` | Granular page access grants per judge per hackathon |
| `registrations` | Public registration applications (pending/approved/rejected) |

### CMS Tables (migration_v5.sql)

| Table | Purpose |
|-------|---------|
| `page_speakers` | Keynote speakers and session chairs (type field distinguishes them) |
| `page_partners` | Sponsors and partners with tier and logo |
| `page_team` | Organizing committee members |

---

## API Reference

All endpoints require `Authorization: Bearer <token>` unless marked public.

### Auth
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | Email + password → JWT |
| GET | `/api/auth/me` | Returns current user payload |
| GET | `/api/auth/github` | Redirect to GitHub OAuth |
| GET | `/api/auth/google` | Redirect to Google OAuth |
| GET | `/api/auth/gitlab` | Redirect to GitLab OAuth |

### Data (Admin)
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/hackathons` | |
| PUT/DELETE | `/api/hackathons/:id` | |
| GET/POST | `/api/judges` | |
| PUT/DELETE | `/api/judges/:id` | |
| GET/POST | `/api/teams` | `?hackathonId=` filter |
| PUT/DELETE | `/api/teams/:id` | |
| GET/POST | `/api/criteria` | `?hackathonId=` filter |
| PUT/DELETE | `/api/criteria/:id` | |
| GET/POST | `/api/feedbacks` | `?hackathonId=` filter |
| DELETE | `/api/feedbacks/:id` | Admin only |
| GET/POST | `/api/users` | Admin only |
| PUT/DELETE | `/api/users/:id` | Admin only |
| POST | `/api/assignments` | `{ hackathonId, userId }` |
| DELETE | `/api/assignments/:hackathonId/:userId` | |
| POST | `/api/permissions` | `{ userId, hackathonId, page }` |
| DELETE | `/api/permissions/:id` | |

### CMS (Admin)
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/speakers` | `?hackathonId=&type=keynote\|session_chair` |
| PUT/DELETE | `/api/speakers/:id` | |
| GET/POST | `/api/partners` | `?hackathonId=` |
| PUT/DELETE | `/api/partners/:id` | |
| GET/POST | `/api/orgteam` | `?hackathonId=` |
| PUT/DELETE | `/api/orgteam/:id` | |
| GET/POST/PUT/DELETE | `/api/registrations` | |

### Public (No Auth)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/public/hackathons` | Published hackathons only |
| GET | `/api/pubpage/:id` | Full page data for published hackathon |
| POST | `/api/public/register` | Submit registration application |

---

## Scoring Formula

The weighted score displayed throughout the app is:

```
score = Σ (criterionScore / criterionMaxScore × criterionWeight) / Σ criterionWeight × 10
```

Example with three criteria:
```
Innovation (30%): 8/10  →  8/10 × 30 = 24
Technical  (25%): 7/10  →  7/10 × 25 = 17.5
Impact     (20%): 9/10  →  9/10 × 20 = 18

Total weight used = 75%
Score = (24 + 17.5 + 18) / 75 × 10 = 7.9
```

Color thresholds: 🟢 ≥ 8.0 · 🔵 ≥ 6.0 · 🟡 ≥ 4.0 · 🔴 < 4.0

---

## License

MIT — free to use, modify, and deploy.

---

*Built with React, Express, and Neon PostgreSQL. Deployed on Vercel.*
