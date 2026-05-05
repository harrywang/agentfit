import { app, BrowserWindow, shell, dialog, utilityProcess } from 'electron'
import { createServer } from 'net'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import http from 'http'
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg

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
const PREFERRED_PORT = 13749

let serverProcess = null
let mainWindow = null
let activePort = PREFERRED_PORT

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = createServer()
    server.listen(startPort, '127.0.0.1', () => {
      server.close(() => resolve(startPort))
    })
    server.on('error', () => resolve(findAvailablePort(startPort + 1)))
  })
}

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

async function ensureDatabase() {
  const schemaSQL = path.join(PRISMA_DIR, 'schema.sql')

  if (!existsSync(schemaSQL)) {
    throw new Error(`schema.sql not found at ${schemaSQL}. Run "npm run prisma:schema-sql" first.`)
  }

  log(existsSync(DB_PATH) ? 'Checking database schema...' : 'Creating database...')

  // Run DB init inline to avoid spawning a child Electron process,
  // which causes a second dock icon on macOS.
  // Uses @libsql/client (already bundled) — works on macOS, Linux, and Windows.
  // schema.sql uses IF NOT EXISTS — safe to run on existing DBs.
  try {
    const serverDir = isPacked
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'server')
      : path.join(import.meta.dirname, 'server')
    const require = createRequire(path.join(serverDir, 'package.json'))
    const { createClient } = require('@libsql/client')

    const client = createClient({ url: `file:${DB_PATH}` })
    const sql = readFileSync(schemaSQL, 'utf-8')
    await client.executeMultiple(sql)

    // Add missing columns for existing databases (IF NOT EXISTS is not supported
    // for ALTER TABLE in SQLite, so we catch and ignore "duplicate column" errors)
    const migrations = [
      'ALTER TABLE "Session" ADD COLUMN "cliVersion" TEXT NOT NULL DEFAULT \'unknown\'',
      'ALTER TABLE "Session" ADD COLUMN "modelCountsJson" TEXT NOT NULL DEFAULT \'{}\'',
    ]
    for (const stmt of migrations) {
      try { await client.execute(stmt) } catch { /* column already exists */ }
    }

    client.close()
    log('Database ready.')
  } catch (err) {
    log(`Database setup warning: ${err.message}`)
  }
}

async function startServer() {
  const serverJs = path.join(SERVER_DIR, 'server.js')

  if (!existsSync(serverJs)) {
    throw new Error(`Server not found at ${serverJs}. Run "npm run electron:prepare" first.`)
  }

  activePort = await findAvailablePort(PREFERRED_PORT)
  if (activePort !== PREFERRED_PORT) {
    log(`Port ${PREFERRED_PORT} is in use, using ${activePort} instead`)
  }

  log(`Starting server from ${serverJs}`)

  // Use utilityProcess.fork() instead of child_process.spawn() to avoid
  // a second dock icon on macOS. It runs as a background Node.js process.
  serverProcess = utilityProcess.fork(serverJs, [], {
    cwd: SERVER_DIR,
    stdio: 'pipe',
    serviceName: 'agentfit-server',
    env: {
      ...process.env,
      PORT: String(activePort),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: `file:${DB_PATH}`,
      NODE_ENV: 'production',
    },
  })

  serverProcess.stdout?.on('data', (d) => log(d.toString().trim()))
  serverProcess.stderr?.on('data', (d) => log(d.toString().trim()))
  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      log(`Server exited with code ${code}`)
    }
  })

  // Poll until ready
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      attempts++
      http.get(`http://127.0.0.1:${activePort}`, () => resolve()).on('error', () => {
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
    show: false, // wait until maximized so the user doesn't see the resize jump
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.maximize()
  mainWindow.show()

  mainWindow.loadURL(`http://127.0.0.1:${activePort}`)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupAutoUpdate() {
  if (!app.isPackaged) return // skip in dev — there's no signed build to update

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} }

  autoUpdater.on('error', (err) => log(`Updater error: ${err?.message || err}`))
  autoUpdater.on('update-available', (info) => log(`Update available: ${info?.version}`))
  autoUpdater.on('update-not-available', () => log('No update available'))
  autoUpdater.on('update-downloaded', async (info) => {
    log(`Update downloaded: ${info?.version}`)
    const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `AgentFit ${info?.version} is ready to install.`,
      detail: 'Restart the app to finish updating.',
    })
    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  // Don't block startup; check shortly after the window is ready.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => log(`Update check failed: ${err?.message || err}`))
  }, 5_000)
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
    await ensureDatabase()
    await startServer()
    splash.close()
    createWindow()
    setupAutoUpdate()
  } catch (err) {
    splash.close()
    log(`Startup error: ${err.message}`)
    dialog.showErrorBox('AgentFit Startup Error', `Failed to start: ${err.message}`)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  app.quit()
})

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
