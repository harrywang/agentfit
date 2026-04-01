import { app, BrowserWindow, shell, dialog } from 'electron'
import { execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import http from 'http'

const isPacked = app.isPackaged

// In packed app, asarUnpacked content is at app.asar.unpacked
const SERVER_DIR = isPacked
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'server')
  : path.join(import.meta.dirname, 'server')

const PRISMA_DIR = isPacked
  ? path.join(process.resourcesPath, 'prisma')
  : path.join(import.meta.dirname, '..', 'prisma')

const USER_DATA = app.getPath('userData')
const DB_PATH = path.join(USER_DATA, 'agentfit.db')
const PORT = 13749

let serverProcess = null
let mainWindow = null

function log(msg) {
  try {
    console.log(`[AgentFit] ${msg}`)
  } catch {
    // Ignore EPIPE — no terminal in packaged app
  }
}

// Prevent uncaught EPIPE from crashing the app
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE') return
  throw err
})

function ensureDatabase() {
  const schemaSQL = path.join(PRISMA_DIR, 'schema.sql')
  const initScript = isPacked
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'init-db.mjs')
    : path.join(import.meta.dirname, 'init-db.mjs')

  if (!existsSync(schemaSQL)) {
    throw new Error(`schema.sql not found at ${schemaSQL}. Run "npm run prisma:schema-sql" first.`)
  }

  log(existsSync(DB_PATH) ? 'Checking database schema...' : 'Creating database...')

  // Run init-db.mjs using Electron's bundled Node.js runtime.
  // Uses @libsql/client (already bundled) — works on macOS, Linux, and Windows.
  // schema.sql uses IF NOT EXISTS — safe to run on existing DBs.
  try {
    execSync(
      `"${process.execPath}" "${initScript}" "${DB_PATH}" "${schemaSQL}"`,
      {
        stdio: 'pipe',
        timeout: 15000,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      }
    )
    log('Database ready.')
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message
    log(`Database setup warning: ${stderr}`)
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverJs = path.join(SERVER_DIR, 'server.js')

    if (!existsSync(serverJs)) {
      reject(new Error(`Server not found at ${serverJs}. Run "npm run electron:prepare" first.`))
      return
    }

    log(`Starting server from ${serverJs}`)

    // In packaged Electron, process.execPath is the Electron binary.
    // We need to set ELECTRON_RUN_AS_NODE=1 so it acts as plain Node.js.
    serverProcess = spawn(process.execPath, [serverJs], {
      cwd: SERVER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(PORT),
        HOSTNAME: '127.0.0.1',
        DATABASE_URL: `file:${DB_PATH}`,
        NODE_ENV: 'production',
      },
    })

    serverProcess.stdout?.on('data', (d) => log(d.toString().trim()))
    serverProcess.stderr?.on('data', (d) => log(d.toString().trim()))
    serverProcess.on('error', (err) => {
      log(`Server process error: ${err.message}`)
      reject(err)
    })
    serverProcess.on('exit', (code) => {
      if (code !== null && code !== 0) {
        log(`Server exited with code ${code}`)
      }
    })

    // Poll until ready
    let attempts = 0
    const check = () => {
      attempts++
      http.get(`http://127.0.0.1:${PORT}`, () => resolve()).on('error', () => {
        if (attempts >= 60) reject(new Error('Server failed to start within 30s'))
        else setTimeout(check, 500)
      })
    }
    setTimeout(check, 1000)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'AgentFit',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function showSplash() {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
  })

  splash.loadURL(`data:text/html,
    <html>
    <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;background:rgba(0,0,0,0.85);color:white;border-radius:16px;-webkit-app-region:drag;">
      <div style="text-align:center">
        <h1 style="font-size:28px;margin-bottom:8px">AgentFit</h1>
        <p style="opacity:0.7;font-size:14px">Starting server...</p>
      </div>
    </body>
    </html>
  `)

  return splash
}

app.whenReady().then(async () => {
  const splash = showSplash()

  try {
    ensureDatabase()
    await startServer()
    splash.close()
    createWindow()
  } catch (err) {
    splash.close()
    log(`Startup error: ${err.message}`)
    dialog.showErrorBox('AgentFit Startup Error', `Failed to start: ${err.message}`)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
  app.quit()
})

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
