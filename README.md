# LeadTracker by Elivate

A lightweight lead management app built for freelancers and independent consultants. LeadTracker replaces scattered spreadsheets with a configurable pipeline, automatic stale-lead detection, and real-time follow-up reminders via email.

**Live at:** [leadtracker.elivate.io](https://leadtracker.elivate.io)

## Features

- **Kanban board** — Drag-and-drop leads between pipeline stages
- **List view** — Searchable, filterable table with bulk actions (delete, change stage)
- **Stale lead detection** — Automatically flags leads past their stage SLA
- **Email reminders** — Sends follow-up emails via Resend when leads go stale
- **Snooze** — One-click magic link in emails to snooze reminders for 3 days
- **Inline editing** — Click any field on a lead, edit it, blur to save
- **Activity timeline** — Every action (stage changes, notes, edits, reminders) is logged
- **Configurable pipeline** — Add, rename, reorder, and delete stages with custom SLA days
- **Required fields** — Define which fields a lead needs to be "complete"
- **Keyboard shortcuts** — `n` new lead, `s` stale view, `/` search
- **Responsive** — Full mobile experience with hamburger menu

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth (email/password + magic link) |
| Email | Resend + React Email |
| State | TanStack Query |
| Forms | React Hook Form |
| Drag & Drop | @dnd-kit |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A [Supabase](https://supabase.com) project
- A [Resend](https://resend.com) account (for email reminders)

### Setup

1. Clone the repo and install dependencies:

```bash
pnpm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=random-32-char-string
SNOOZE_TOKEN_SECRET=random-32-char-string
RESEND_API_KEY=re_your_resend_key
```

3. Run the database migration in your Supabase SQL Editor:

```bash
# The migration file is at:
supabase/migrations/001_initial_schema.sql
```

4. Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Project Structure

```
src/
  app/
    (auth)/          # Login, signup pages
    (app)/           # Authenticated app shell
      leads/         # Board, list, stale, detail views
      settings/      # General, stages, profile
    api/             # REST routes (leads, stages, dashboard, cron, etc.)
    snooze/          # Public magic-link snooze page
  components/
    layout/          # Sidebar, header, mobile nav
    leads/           # Lead card, stage column, new lead dialog
    dashboard/       # Stat card
    ui/              # shadcn/ui components
  emails/            # React Email templates
  hooks/             # TanStack Query hooks
  lib/               # Supabase clients, types, utilities
```

## Deployment

The app is configured for Vercel:

1. Push to GitHub
2. Import the repo on [Vercel](https://vercel.com)
3. Set all environment variables from `.env.local`
4. Verify your sending domain in Resend (SPF/DKIM/DMARC)
5. The cron job (`/api/cron/check-stale`) runs every 5 minutes via `vercel.json`

## Design

Warm editorial aesthetic — cream background, dark ink text, coral accents, serif headlines. Inspired by Basecamp (warmth), Linear (speed), and Notion (inline editing).

**Fonts:** Instrument Serif (headings) + Onest (body)

## Author

Built by [Boko Isaac](https://elivate.io) under the Elivate brand.
