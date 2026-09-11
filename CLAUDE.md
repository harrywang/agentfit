# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript check
npm run electron:build:mac  # Build signed+notarized macOS DMG
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

- **Sync** (`lib/sync.ts`): Recursively walks `**/*.jsonl` under each project dir (top-level conversations + nested `subagents/agent-*.jsonl` files), parses every line on every run, writes per-message `MessageUsage` rows deduped by `(messageId, requestId)`, upserts the per-conversation `Session` row, extracts base64 images to `data/images/{sessionId}/`. Final SQL pass rolls sub-agent token/cost sums up into the parent `Session` row.
- **Queries** (`lib/queries.ts`): Daily breakdown + overview cost/token totals come from `MessageUsage` (deduped, per-(date, model)). Per-session counters (sessions, user/assistant messages, tool calls, interruptions) come from `Session`. Codex logs (`lib/queries-codex.ts`) are parsed live without DB storage.
- **Pricing** (`lib/pricing.ts`): Fetches LiteLLM JSON at runtime, falls back to hardcoded prices. Applies 200k tiered pricing and the `speed=fast` provider multiplier (ported from ccusage, MIT). Unknown models return 0 cost — no silent Sonnet fallback.

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

Prisma 7 with LibSQL adapter for SQLite (`agentfit.db` in project root). Core models:
- **Session** — metrics per conversation (one row per top-level JSONL). Token/cost columns are derived — they get rebuilt from `MessageUsage` at the end of every sync, so don't treat them as authoritative.
- **MessageUsage** — one row per assistant message with `(messageId, requestId)` unique. This is the source of truth for daily totals and cost. Sub-agent rows attribute to the parent's `sessionId` via the per-line `sessionId` field in the JSONL.
- **Image** — extracted screenshot metadata (files stored on disk, not in DB)
- **SyncLog** — sync history

After schema changes: run `npx prisma migrate dev` then `npx prisma generate`. The generated client lives in `generated/prisma/` (gitignored).

**IMPORTANT — Electron DB schema:** The Electron app does NOT use Prisma migrations. It creates/updates the DB from `prisma/schema.sql` + inline `ALTER TABLE` statements in `electron/main.mjs`. After any schema change you MUST:
1. Update `prisma/schema.sql` to match the current Prisma schema (all tables, columns, indexes). New tables use `CREATE TABLE IF NOT EXISTS` so they pick up automatically on next launch.
2. For new *columns* on existing tables, add `ALTER TABLE … ADD COLUMN` statements to the migrations array in `electron/main.mjs` so existing users' databases get upgraded without data loss.

### Why daily totals match ccusage

The daily breakdown is designed to agree with `ccusage daily` to the cent. If you change the sync, aggregation, or pricing, validate with the dev server running:

```bash
npm run check:parity                              # last 14 days
npm run check:parity -- --since 2026-06-01 --until 2026-06-30
```

`scripts/check-parity.mjs` syncs via `/api/sync`, reads `/api/usage?agent=claude`, runs the ccusage CLI over the same range (local checkout at `~/sandbox/ccusage` if present, else `npx -y ccusage`; override with `CCUSAGE_CMD`), and diffs per-day tokens exactly and cost to the cent. It exits 1 on mismatch. Caveats: today's row can show small token drift while a session is actively appending (sync race, not a bug) — verify against settled days; and the local ccusage checkout can itself go stale (a May-built dist priced newer models differently) — when only cost disagrees while tokens match, cross-check with `CCUSAGE_CMD="npx -y ccusage@latest"` before assuming our pipeline is wrong.

Non-obvious invariants that make this work — don't break them:
- **Always re-read every JSONL.** Claude Code appends to the same file throughout a session, so a "skip if sessionId already imported" cache permanently freezes partial counts. Idempotency comes from the `(messageId, requestId)` unique index on `MessageUsage`, not from skipping files.
- **Recurse into `subagents/`.** Sub-agent JSONLs (`<sessionDir>/subagents/agent-*.jsonl`) carry haiku/opus token usage that's missing from the top-level file. Ours and ccusage's totals only agree when these are included.
- **Local-timezone date bucket.** Use `Intl.DateTimeFormat('en-CA')` with no `timeZone` option (matches ccusage `apps/ccusage/src/_date-utils.ts:43-48`). Switching to `toISOString().slice(0,10)` (UTC) shifts cross-midnight tokens to the wrong day and breaks parity.
- **Per-message tiered pricing + `speed=fast` multiplier.** Any cost calculation must use `lib/pricing.ts:calculateCost(model, usage, pricing, speed)` — the 200k tier and 6× Opus-fast multiplier matter.
- **Client-side filters must trim, not rebuild.** When `timeRange ≠ 'all'`, `components/data-provider.tsx:filterData` slices `raw.daily` by date (preserving `modelBreakdowns`) when `project='all'`. Rebuilding daily from session-level rollups instead loses the per-(date, model) split (haiku rows disappear from the UI), buckets cross-midnight tokens by `s.startTime` UTC date instead of local-tz, and drifts from `MessageUsage` totals. Only fall back to a session rebuild when a project filter is active, since per-message rows aren't tagged by project on the client.
- **Pricing must survive a failed LiteLLM fetch.** `lib/pricing.ts:loadPricing` reaches `raw.githubusercontent.com`, which is unreachable on plenty of networks — and Node's `fetch` ignores `http_proxy`/`https_proxy` unless `NODE_USE_ENV_PROXY=1`, so on a proxied machine it used to hang for minutes and then fall through. Three guards keep that from silently zero-costing real usage: a 15s `AbortSignal.timeout`, a `data/pricing.json` snapshot written on every success and read back on failure, and `getFallbackPricing()` as the last resort. **Add every new model to `getFallbackPricing()` as it ships** — a model missing from it makes `findPricing` return null and `calculateCost` report $0 for genuine tokens. That is exactly how `claude-opus-5`, `claude-fable-5`, `claude-fable-5-1` and `claude-opus-4-8` ended up costing $0 for ~40k messages while the token counts stayed correct. `electron/main.mjs` asks Chromium for the system proxy and forwards it to the server process, since a Finder-launched app inherits no shell env.
- **Don't double-cache the LiteLLM fetch.** `lib/pricing.ts:loadPricing` uses `fetch(url, { cache: 'no-store' })` and refuses to memoize an empty result. `next: { revalidate: 86400 }` once memoized a stale/empty body into the in-process `pricingCache` and zero-costed every newly-listed model (e.g. `claude-opus-4-7`) until the process restarted. The in-process cache alone is enough.
- **Duplicate `(messageId, requestId)` lines are streaming snapshots — first one wins.** A single assistant message can be logged several times in the JSONL with growing `output_tokens` (interim vs final snapshot). ccusage's `createUniqueHash` dedup keeps the *first* occurrence for both tokens and cost. Our insert must do the same: token columns come from the first insert, and the `ON CONFLICT` clause must not let a later snapshot's cost through — `MAX(old, excluded)` did exactly that (tokens from snapshot 1, cost from snapshot 3), silently inflating daily totals ~1–3% above ccusage.
- **`MessageUsage` writes must still self-heal cost — in both directions.** On conflict, set `costUSD = excluded.costUSD` only when `excluded.costUSD > 0` AND all four token columns equal the stored row (same snapshot, re-priced), else keep the old value. The token-equality guard rejects later streaming snapshots (see above); the `> 0` guard keeps a pricing-fetch outage from zeroing good values; and accepting the fresh value otherwise lets rows written under a stale/wrong LiteLLM snapshot (launch-window prices that later got corrected downward — happened with `claude-fable-5`) heal on the next resync. Plain `INSERT OR IGNORE` freezes first-synced prices forever; `MAX` heals upward only. `npm run check:parity` catches this whole class of drift.

### Key Conventions

- Shadcn UI v4 with Base UI primitives (not Radix) — components in `components/ui/`
- Chart colors: 10 CSS variables `--chart-1` through `--chart-10` in `app/globals.css` (oklch)
- API routes that read from DB use `lib/db.ts` singleton; sync writes also go through it
- `lib/format.ts` has shared formatters (cost, tokens, duration) — use these, don't inline formatting
- Images served via `/api/images/[...path]` catch-all route from `data/images/`
- `data/images/` and `agentfit.db` are gitignored — local data only

### Desktop Distribution

Electron app built via electron-builder. macOS DMGs are code-signed and notarized via GitHub Actions (`release.yml`, triggered by `v*` tags). Notarization requires three GitHub secrets: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (in addition to `CERTIFICATE_P12` and `CERTIFICATE_PASSWORD` for signing).

**`electron-builder.yml` file globs are unscoped — `!node_modules` matches at any depth.** When tightening the bundle, every `node_modules` you actually need has to be re-included by name. Specifically:
- Transitive runtime deps of `electron-updater` (e.g. `sax` via `builder-util-runtime`) — without these the main process crashes at launch with `Cannot find module 'sax'`.
- `electron/server/node_modules/**/*` — the standalone Next server's own deps, including `@libsql/client`. Otherwise the local server fails to boot.
- `electron/server/.next/node_modules/**/*` — Turbopack chunks reference Prisma's hash-suffixed package by name (e.g. `@prisma/client-2c3a283f134fdcb6`). Without it API routes throw `Cannot find module` at request time.

Verify locally with an unsigned build (`CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac -c.mac.notarize=false -c.mac.identity=null`) and inspect `app.asar.unpacked/electron/server/.next/node_modules` before tagging a release.

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
