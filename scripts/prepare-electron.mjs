#!/usr/bin/env node

/**
 * Prepare the Next.js standalone build for Electron packaging.
 * Resolves symlinks and copies everything into a flat directory structure
 * that electron-builder can handle.
 */

import { cpSync, existsSync, mkdirSync, rmSync, unlinkSync, symlinkSync, readlinkSync, lstatSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const STANDALONE = path.join(ROOT, '.next', 'standalone')
const DEST = path.join(ROOT, 'electron', 'server')

console.log('Preparing standalone build for Electron...')

// Clean previous
if (existsSync(DEST)) {
  rmSync(DEST, { recursive: true, force: true })
}
mkdirSync(DEST, { recursive: true })

// Copy standalone output, dereferencing symlinks
cpSync(STANDALONE, DEST, { recursive: true, dereference: true })

// Fix any remaining symlinks that point to absolute paths outside DEST
// These get created when dereference follows a chain that resolves to an absolute path
function fixSymlinks(dir) {
  if (!existsSync(dir)) return
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    try {
      const stat = lstatSync(fullPath)
      if (stat.isSymbolicLink()) {
        const target = readlinkSync(fullPath)
        // If the symlink points outside DEST, resolve it
        if (path.isAbsolute(target) || !target.startsWith('.')) {
          // Try to find the equivalent within DEST
          // These Next.js internal symlinks point to node_modules in the parent
          const moduleName = entry.name.replace(/-[a-f0-9]+$/, '') // strip hash suffix
          const parentModuleDir = path.join(DEST, 'node_modules', path.dirname(fullPath).split('node_modules/').pop().split('/')[0] === '@' ? path.dirname(fullPath).split('node_modules/').pop() : '')

          // The target is usually in ../../../node_modules/@scope/module
          // which in DEST is just DEST/node_modules/@scope/module
          const scope = path.basename(path.dirname(fullPath))
          const resolvedInDest = path.join(DEST, 'node_modules', scope, moduleName)

          if (existsSync(resolvedInDest)) {
            console.log(`  Fixing symlink: ${path.relative(DEST, fullPath)} -> ${path.relative(DEST, resolvedInDest)}`)
            unlinkSync(fullPath)
            // Copy the actual module contents
            cpSync(resolvedInDest, fullPath, { recursive: true, dereference: true })
          } else {
            console.log(`  Warning: Cannot resolve symlink ${path.relative(DEST, fullPath)} -> ${target}`)
            // Remove broken symlink
            unlinkSync(fullPath)
          }
        }
      } else if (stat.isDirectory()) {
        fixSymlinks(fullPath)
      }
    } catch (e) {
      // Skip errors on individual files
    }
  }
}

fixSymlinks(path.join(DEST, '.next', 'node_modules'))

// Copy static files (Next.js standalone doesn't include them)
const staticSrc = path.join(ROOT, '.next', 'static')
const staticDest = path.join(DEST, '.next', 'static')
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true })
}

// Copy public directory
const publicSrc = path.join(ROOT, 'public')
const publicDest = path.join(DEST, 'public')
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true })
}

// Remove local data and stale build artifacts that got copied from standalone
for (const localPath of ['data', 'agentfit.db', 'dist-electron']) {
  const p = path.join(DEST, localPath)
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    console.log(`  Removed local data: ${localPath}`)
  }
}

// Remove unnecessary large packages from standalone node_modules
const pruneList = ['typescript', '@img', 'sharp', '@next/swc-linux-x64-gnu', '@next/swc-linux-x64-musl', '@next/swc-linux-arm64-gnu', '@next/swc-linux-arm64-musl', '@next/swc-win32-x64-msvc', '@next/swc-win32-arm64-msvc']
for (const pkg of pruneList) {
  const pkgPath = path.join(DEST, 'node_modules', pkg)
  if (existsSync(pkgPath)) {
    rmSync(pkgPath, { recursive: true, force: true })
    console.log(`  Pruned: node_modules/${pkg}`)
  }
}

// Verify no symlinks remain
try {
  const remaining = execSync(`find "${DEST}" -type l 2>/dev/null`).toString().trim()
  if (remaining) {
    console.log('\nWarning: remaining symlinks found:')
    console.log(remaining)
  } else {
    console.log('\nNo symlinks remaining - clean build!')
  }
} catch (e) {
  // find returns non-zero if no matches
}

console.log('Done! Standalone server prepared at electron/server/')
