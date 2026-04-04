#!/usr/bin/env node

import { execSync, spawn } from 'child_process'
import { createServer } from 'net'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = createServer()
    server.listen(startPort, () => {
      server.close(() => resolve(startPort))
    })
    server.on('error', () => resolve(findAvailablePort(startPort + 1)))
  })
}

const preferredPort = parseInt(process.env.AGENTFIT_PORT || process.env.PORT || '3000', 10)
const PORT = await findAvailablePort(preferredPort)

function info(msg) {
  console.log(`\x1b[1;34m==>\x1b[0m ${msg}`)
}
function ok(msg) {
  console.log(`\x1b[1;32m==>\x1b[0m ${msg}`)
}
function error(msg) {
  console.error(`\x1b[1;31m==>\x1b[0m ${msg}`)
}

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })
}

// ─── Ensure .env exists ─────────────────────────────────────────────
const envPath = path.join(ROOT, '.env')
if (!existsSync(envPath)) {
  writeFileSync(envPath, 'DATABASE_URL="file:./agentfit.db"\n')
}

// ─── First-run setup: prisma generate + migrate ─────────────────────
const generatedClient = path.join(ROOT, 'generated', 'prisma')
if (!existsSync(generatedClient)) {
  info('First run detected — generating Prisma client...')
  run('npx prisma generate')
}

// Run migrations — creates DB if new, applies pending migrations if existing.
// migrate deploy is a no-op when already up to date.
info('Applying database migrations...')
run('npx prisma migrate deploy')

// ─── Build if .next doesn't exist ───────────────────────────────────
const nextDir = path.join(ROOT, '.next')
if (!existsSync(nextDir)) {
  info('Building production bundle (first run)...')
  run('npm run build')
}

// ─── Start server ───────────────────────────────────────────────────
if (PORT !== preferredPort) {
  info(`Port ${preferredPort} is in use, using ${PORT} instead`)
}
ok(`Starting AgentFit on http://localhost:${PORT}`)
console.log('  Press Ctrl+C to stop.\n')

const server = spawn('npx', ['next', 'start', '-p', PORT], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, PORT },
})

server.on('close', (code) => process.exit(code ?? 0))

// Forward signals
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.kill(sig)
  })
}
