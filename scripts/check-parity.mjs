#!/usr/bin/env node
// Parity check: agentfit's daily breakdown vs `ccusage daily --json`.
// See CLAUDE.md "Why daily totals match ccusage" — run this after touching
// lib/sync.ts, lib/queries.ts, or lib/pricing.ts, and before a release.
//
// Requires the dev server (it syncs first, then reads /api/usage?agent=claude).
//
// Usage:
//   npm run check:parity                     # last 14 days against localhost:3000
//   npm run check:parity -- --days 30
//   npm run check:parity -- --since 2026-06-01 --until 2026-06-30
//   AGENTFIT_URL=http://localhost:3100 CCUSAGE_CMD="npx -y ccusage" npm run check:parity

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const COST_TOLERANCE = 0.005 // "to the cent"
const LOCAL_CCUSAGE = '/Users/harrywang/sandbox/ccusage/apps/ccusage/dist/index.js'

// ─── Args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}

const baseUrl = argValue('--url') ?? process.env.AGENTFIT_URL ?? 'http://localhost:3000'
const days = Number(argValue('--days') ?? 14)

// Local-timezone date key, same formatter as the sync pipeline (see CLAUDE.md:
// switching to toISOString() shifts cross-midnight tokens to the wrong day).
const localDate = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDate.format(d)
}

const since = argValue('--since') ?? daysAgo(days - 1)
const until = argValue('--until') ?? daysAgo(0)

if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
  console.error('Dates must be YYYY-MM-DD')
  process.exit(2)
}

// ─── Fetch both sides ────────────────────────────────────────────────

async function fetchAgentfitDaily() {
  let syncRes
  try {
    syncRes = await fetch(`${baseUrl}/api/sync`, { method: 'POST' })
  } catch {
    console.error(`Cannot reach ${baseUrl} — start the dev server (npm run dev) or pass --url.`)
    process.exit(2)
  }
  if (!syncRes.ok) {
    console.error(`Sync failed: ${syncRes.status} ${await syncRes.text()}`)
    process.exit(2)
  }

  const usageRes = await fetch(`${baseUrl}/api/usage?agent=claude`)
  if (!usageRes.ok) {
    console.error(`/api/usage failed: ${usageRes.status}`)
    process.exit(2)
  }
  const { daily } = await usageRes.json()
  const map = new Map()
  for (const d of daily) {
    if (d.date < since || d.date > until) continue
    map.set(d.date, {
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
      cacheCreationTokens: d.cacheCreationTokens,
      cacheReadTokens: d.cacheReadTokens,
      cost: d.costUSD,
    })
  }
  return map
}

async function fetchCcusageDaily() {
  const cmd =
    process.env.CCUSAGE_CMD ?? (existsSync(LOCAL_CCUSAGE) ? `node ${LOCAL_CCUSAGE}` : 'npx -y ccusage')
  const [bin, ...prefix] = cmd.split(' ')
  const compact = (d) => d.replaceAll('-', '')
  const { stdout } = await execFileAsync(
    bin,
    [...prefix, 'daily', '--since', compact(since), '--until', compact(until), '--json'],
    { maxBuffer: 64 * 1024 * 1024 }
  )
  const { daily } = JSON.parse(stdout)
  const map = new Map()
  for (const d of daily) {
    // ccusage ≤ v18 uses `date`; v20+ renamed it to `period`
    map.set(d.date ?? d.period, {
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
      cacheCreationTokens: d.cacheCreationTokens,
      cacheReadTokens: d.cacheReadTokens,
      cost: d.totalCost,
    })
  }
  return map
}

// ─── Compare ─────────────────────────────────────────────────────────

const [ours, theirs] = await Promise.all([fetchAgentfitDaily(), fetchCcusageDaily()])

const allDates = [...new Set([...ours.keys(), ...theirs.keys()])].sort()
const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheCreationTokens', 'cacheReadTokens']
const EMPTY = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, cost: 0 }

let failures = 0
const fmtCost = (c) => `$${c.toFixed(4)}`

console.log(`\nParity check ${since} → ${until} (agentfit @ ${baseUrl} vs ccusage)\n`)

for (const date of allDates) {
  const a = ours.get(date) ?? EMPTY
  const b = theirs.get(date) ?? EMPTY
  const problems = []

  for (const f of TOKEN_FIELDS) {
    if (a[f] !== b[f]) problems.push(`${f}: ${a[f]} vs ${b[f]} (Δ ${a[f] - b[f]})`)
  }
  const costDiff = a.cost - b.cost
  if (Math.abs(costDiff) > COST_TOLERANCE) {
    problems.push(`cost: ${fmtCost(a.cost)} vs ${fmtCost(b.cost)} (Δ ${fmtCost(costDiff)})`)
  }

  if (problems.length === 0) {
    console.log(`  ✓ ${date}  ${fmtCost(a.cost)}`)
  } else {
    failures++
    console.log(`  ✗ ${date}`)
    for (const p of problems) console.log(`      ${p}`)
  }
}

const total = (map) => [...map.values()].reduce((s, d) => s + d.cost, 0)
console.log(
  `\nTotals: agentfit ${fmtCost(total(ours))} | ccusage ${fmtCost(total(theirs))} | ${allDates.length} day(s), ${failures} mismatch(es)`
)

if (failures > 0) {
  console.error('\nPARITY BROKEN — see CLAUDE.md invariants before "fixing" the numbers.')
  process.exit(1)
}
console.log('\nParity OK ✓')
