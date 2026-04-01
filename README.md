# AgentFit

Fitness tracker dashboard for AI coding agents. Reads your local Claude Code and Codex conversation logs, syncs them into a SQLite database, and presents rich usage analytics — cost, tokens, tool usage, productivity patterns, and more.

## Install

### Option 1: Desktop App (recommended)

Download a pre-built installer from the [Releases](https://github.com/harrywang/agentfit/releases) page:

- **macOS**: `AgentFit-x.x.x.dmg` (Intel) or `AgentFit-x.x.x-arm64.dmg` (Apple Silicon)
- **Windows**: `AgentFit-x.x.x.exe`

### Option 2: One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/harrywang/agentfit/main/setup.sh | bash
```

### Option 3: npx

```bash
npx agentfit
```

### Option 4: Manual

```bash
git clone https://github.com/harrywang/agentfit.git
cd agentfit
npm install
echo 'DATABASE_URL="file:./agentfit.db"' > .env
npx prisma migrate deploy
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000). The app auto-syncs your Claude Code (`~/.claude/projects/`) and Codex (`~/.codex/sessions/`) logs on first load.

**Requirements:** Node.js 20+ (Options 2–4)

## The CRAFT Framework

AgentFit scores your AI coding proficiency using **CRAFT** — a Human-AI coding proficiency framework by [Harry Wang](https://harrywang.me). All metrics are computed from your local conversation logs.

| | Dimension | What it measures | Key metrics |
|---|---|---|---|
| **C** | **Context** | How effectively you engineer context for the AI | CLAUDE.md usage, memory writes, cache hit rate |
| **R** | **Reach** | How broadly you leverage available capabilities | Tool diversity, subagent usage, skill adoption |
| **A** | **Autonomy** | How independently the agent works for you | Message ratio, interruption rate, delegation |
| **F** | **Flow** | How consistently you maintain a coding rhythm | Streak length, daily consistency, active days |
| **T** | **Throughput** | How much output you get for your investment | Cost efficiency, output volume, error rate |

Inspired by [DORA Metrics](https://dora.dev) and Microsoft's [SPACE framework](https://queue.acm.org/detail.cfm?id=3454124). Behavioral signals from your logs — no surveys, no guesswork. Each dimension is scored 0–100.

## Features

- **Dashboard** — overview stats (cost, tokens, sessions, projects, messages, tool calls, duration)
- **CRAFT Coach** — fitness score, achievements, and actionable improvement tips
- **Daily Usage** — daily cost and activity charts
- **Token Breakdown** — pie chart + stacked area chart of token types
- **Tool Usage** — top tools by invocation count
- **Projects** — per-project breakdown with top tools and sessions
- **Sessions** — individual session details with chat logs and tool flow graphs
- **Personality Fit** — MBTI-style behavioral analysis
- **Command Usage** — slash command pattern tracking
- **Images** — screenshot analysis across sessions
- **Community Plugins** — extensible analysis views

## Development

Build the desktop app locally:

```bash
npm run electron:build:mac   # Mac (.dmg)
npm run electron:build:win   # Windows (.exe)
```

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript check
npm test             # Run tests
```

## Community Plugins

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. Quick version:

1. Create `plugins/<your-slug>/manifest.ts` and `component.tsx`
2. Register in `plugins/index.ts`
3. Add tests in `component.test.tsx`
4. Submit a PR

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` or `AGENTFIT_PORT` | `3000` | Server port |
| `DATABASE_URL` | `file:./agentfit.db` | SQLite database path |

## Credits

- Logo: [Robot SVG](https://www.svgrepo.com/svg/486361/robot) from SVG Repo (CC0 License)

## License

[MIT](LICENSE)
