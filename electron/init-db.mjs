/**
 * Database initialization script.
 * Spawned by Electron main process with ELECTRON_RUN_AS_NODE=1.
 * Reads schema.sql and executes it against the SQLite database.
 * Uses @libsql/client which is already bundled — works on macOS, Linux, and Windows.
 *
 * Usage: node init-db.mjs <db-path> <schema-sql-path>
 */

import { readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'

const [dbPath, schemaPath] = process.argv.slice(2)

// In packaged app, @libsql/client lives inside electron/server/node_modules
const serverDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'server')
const require = createRequire(path.join(serverDir, 'package.json'))
const { createClient } = require('@libsql/client')

if (!dbPath || !schemaPath) {
  console.error('Usage: node init-db.mjs <db-path> <schema-sql-path>')
  process.exit(1)
}

const client = createClient({ url: `file:${dbPath}` })
const sql = readFileSync(schemaPath, 'utf-8')

try {
  await client.executeMultiple(sql)
  console.log('Database ready.')
} catch (err) {
  console.error(`Database init error: ${err.message}`)
  process.exit(1)
} finally {
  client.close()
}
