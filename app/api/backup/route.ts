import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

interface FolderStatus {
  exists: boolean
  hasGit: boolean
  hasRemote: boolean
  remoteUrl: string | null
  isDirty: boolean
  lastCommit: string | null
}

interface BackupStatus {
  ghInstalled: boolean
  ghAuthenticated: boolean
  ghUser: string | null
  claude: FolderStatus
  codex: FolderStatus
}

function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000 }).trim()
  } catch {
    return ''
  }
}

function getFolderStatus(folderPath: string): FolderStatus {
  if (!existsSync(folderPath)) {
    return { exists: false, hasGit: false, hasRemote: false, remoteUrl: null, isDirty: false, lastCommit: null }
  }

  const hasGit = existsSync(path.join(folderPath, '.git'))
  let hasRemote = false
  let remoteUrl: string | null = null
  let isDirty = false
  let lastCommit: string | null = null

  if (hasGit) {
    remoteUrl = run('git remote get-url origin', folderPath) || null
    hasRemote = !!remoteUrl
    const status = run('git status --porcelain', folderPath)
    isDirty = status.length > 0
    lastCommit = run('git log -1 --format=%ci', folderPath) || null
  }

  return { exists: true, hasGit, hasRemote, remoteUrl, isDirty, lastCommit }
}

export async function GET() {
  const home = homedir()
  const ghInstalled = !!run('which gh', home)
  let ghAuthenticated = false
  let ghUser: string | null = null

  if (ghInstalled) {
    ghUser = run('gh api user -q .login', home) || null
    ghAuthenticated = !!ghUser
  }

  const status: BackupStatus = {
    ghInstalled,
    ghAuthenticated,
    ghUser,
    claude: getFolderStatus(path.join(home, '.claude')),
    codex: getFolderStatus(path.join(home, '.codex')),
  }

  return NextResponse.json(status)
}

const CLAUDE_GITIGNORE = `# Sensitive / ephemeral files
*.lock
*.lock.lock
cache/
chrome/
debug/
downloads/
ide/
image-cache/
paste-cache/
session-env/
telemetry/
mcp-needs-auth-cache.json
.DS_Store
`

const CODEX_GITIGNORE = `# Sensitive files
auth.json
*.lock
tmp/
.DS_Store
`

function initGit(folderPath: string, gitignoreContent: string) {
  const gitignorePath = path.join(folderPath, '.gitignore')
  if (!existsSync(gitignorePath)) {
    require('fs').writeFileSync(gitignorePath, gitignoreContent)
  }
  if (!existsSync(path.join(folderPath, '.git'))) {
    run('git init -b main', folderPath)
  }
}

function commitAll(folderPath: string, message: string): boolean {
  run('git add -A', folderPath)
  const status = run('git status --porcelain', folderPath)
  if (!status) return false
  execSync(`git commit -m "${message}"`, { cwd: folderPath, encoding: 'utf-8', timeout: 30000 })
  return true
}

export async function POST(request: Request) {
  const home = homedir()
  const body = await request.json()
  const { action, folder } = body as { action: string; folder?: 'claude' | 'codex' }

  if (action === 'init') {
    // Initialize and push to GitHub for the first time
    if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 })

    const ghUser = run('gh api user -q .login', home)
    if (!ghUser) {
      return NextResponse.json({ error: 'Not authenticated with GitHub. Run: gh auth login' }, { status: 401 })
    }

    const folderPath = path.join(home, `.${folder}`)
    if (!existsSync(folderPath)) {
      return NextResponse.json({ error: `~/.${folder} does not exist` }, { status: 404 })
    }

    const repoName = `my-${folder}-backup`
    const gitignore = folder === 'claude' ? CLAUDE_GITIGNORE : CODEX_GITIGNORE

    // Init git and .gitignore
    initGit(folderPath, gitignore)

    // Create private repo if it doesn't exist
    const existing = run(`gh repo view ${ghUser}/${repoName} --json name -q .name`, home)
    if (!existing) {
      try {
        execSync(`gh repo create ${repoName} --private --description "Backup of ~/.${folder}"`, {
          cwd: home, encoding: 'utf-8', timeout: 30000,
        })
      } catch (e) {
        return NextResponse.json({ error: `Failed to create repo: ${(e as Error).message}` }, { status: 500 })
      }
    }

    // Set remote
    const currentRemote = run('git remote get-url origin', folderPath)
    const repoUrl = `https://github.com/${ghUser}/${repoName}.git`
    if (!currentRemote) {
      run(`git remote add origin ${repoUrl}`, folderPath)
    } else if (currentRemote !== repoUrl) {
      run(`git remote set-url origin ${repoUrl}`, folderPath)
    }

    // Commit and push
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    commitAll(folderPath, `backup: ${timestamp}`)

    try {
      execSync('git push -u origin main', { cwd: folderPath, encoding: 'utf-8', timeout: 60000 })
    } catch {
      // Try force push on first init (empty remote)
      try {
        execSync('git push -u origin main --force-with-lease', { cwd: folderPath, encoding: 'utf-8', timeout: 60000 })
      } catch (e) {
        return NextResponse.json({ error: `Push failed: ${(e as Error).message}` }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      repoUrl: `https://github.com/${ghUser}/${repoName}`,
    })
  }

  if (action === 'sync') {
    // Sync changes to existing remote
    if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 })

    const folderPath = path.join(home, `.${folder}`)
    if (!existsSync(path.join(folderPath, '.git'))) {
      return NextResponse.json({ error: 'Not initialized. Set up backup first.' }, { status: 400 })
    }

    const remote = run('git remote get-url origin', folderPath)
    if (!remote) {
      return NextResponse.json({ error: 'No remote configured. Set up backup first.' }, { status: 400 })
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const hadChanges = commitAll(folderPath, `backup: ${timestamp}`)

    if (!hadChanges) {
      return NextResponse.json({ success: true, message: 'Already up to date' })
    }

    try {
      execSync('git push origin main', { cwd: folderPath, encoding: 'utf-8', timeout: 60000 })
    } catch (e) {
      return NextResponse.json({ error: `Push failed: ${(e as Error).message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Synced to GitHub' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
