# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript check
npx prisma migrate dev --name <name>  # Create/apply migration
npx prisma generate  # Regenerate Prisma client after schema changes
```

## Architecture

AgentFit is a local-first Next.js 16 dashboard that reads Claude Code and Codex conversation logs from `~/.claude/projects/`, syncs them into a local SQLite database, and presents usage analytics.

### Data Pipeline

```
~/.claude/projects/*.jsonl  →  lib/sync.ts (parse + extract images)
                                    ↓
                              SQLite (agentfit.db) via Prisma
                                    ↓
                              API routes (/api/usage, /api/sync, /api/check)
                                    ↓
                              DataProvider context (client-side state)
                                    ↓
                              Dashboard pages + charts
```

- **Sync** (`lib/sync.ts`): Scans JSONL files, skips already-imported sessions (by sessionId), parses messages/tokens/tool calls, extracts base64 images to `data/images/{sessionId}/`, calculates costs via LiteLLM pricing, writes to SQLite.
- **Queries** (`lib/queries.ts`): Reads sessions from SQLite, aggregates into projects/daily/toolUsage/overview stats. Codex logs (`lib/queries-codex.ts`) are parsed live without DB storage.
- **Pricing** (`lib/pricing.ts`): Fetches model pricing from LiteLLM's GitHub JSON at runtime, falls back to hardcoded prices if fetch fails.

### Client State

`DataProvider` (`components/data-provider.tsx`) manages all dashboard state:
- Fetches `/api/usage?agent=claude|codex|combined`
- Client-side time range filtering (7d/30d/90d/all) — no re-fetch needed
- Polls `/api/check` every 30s for new sessions on disk
- All pages consume via `useData()` hook

### Layout

- Route group `app/(dashboard)/` — 8 pages sharing a common layout
- `DashboardShell` — header (time range toggle, agent selector, sync button) + sidebar
- `AppSidebar` — navigation using shadcn Sidebar component

### Database

Prisma 7 with LibSQL adapter for SQLite (`agentfit.db` in project root). Three models:
- **Session** — metrics per conversation (tokens, cost, duration, tool calls as JSON string)
- **Image** — extracted screenshot metadata (files stored on disk, not in DB)
- **SyncLog** — sync history

After schema changes: run `npx prisma migrate dev` then `npx prisma generate`. The generated client lives in `generated/prisma/` (gitignored).

### Key Conventions

- Shadcn UI v4 with Base UI primitives (not Radix) — components in `components/ui/`
- Chart colors: 10 CSS variables `--chart-1` through `--chart-10` in `app/globals.css` (oklch)
- API routes that read from DB use `lib/db.ts` singleton; sync writes also go through it
- `lib/format.ts` has shared formatters (cost, tokens, duration) — use these, don't inline formatting
- Images served via `/api/images/[...path]` catch-all route from `data/images/`
- `data/images/` and `agentfit.db` are gitignored — local data only

### Coaching Philosophy

AgentFit's CRAFT Coach is a **behavioral improvement tool**, not a cost dashboard. Think of it like a fitness coach — the goal is to help users master AI-assisted coding, not just track spending.

**Priority order for coaching insights:**
1. **Context engineering** — holistic curation of tokens available to the LLM (per Anthropic's context engineering framework): CLAUDE.md as system prompt, just-in-time retrieval (Read/Grep/Glob ratio), compaction habits, structured note-taking (TodoWrite/TaskCreate), sub-agent context isolation, cache efficiency, output token density
2. **Behavioral improvement** — prompting quality (read-before-edit ratio, interruption rate), parallelization (subagent usage), permission trust signals
3. **Workflow efficiency** — session length optimization, command/skill adoption, CLAUDE.md configuration
4. **Discovery** — new commands to try, skills to create, features they don't know exist
5. **Cost** — kept as secondary information, not the primary focus. Many users are on fixed plans and don't care about per-token costs.

**CRAFT "C" dimension (Context)** measures context engineering broadly, not just context window size. It includes: cache reuse (stable context like CLAUDE.md), overflow avoidance, just-in-time retrieval ratio, structured note-taking for agentic memory, output token density (signal-to-noise), and sub-agent context isolation.

**Future direction:** Community benchmarking — compare anonymous behavioral metrics with other users to surface insights like "users with similar projects who use subagents complete tasks 40% faster". This requires opt-in telemetry and aggregation infrastructure (not yet built).
