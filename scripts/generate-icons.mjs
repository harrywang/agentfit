#!/usr/bin/env node

/**
 * Generate app icons for Electron from the SVG logo.
 *
 * Prerequisites: npm install -g sharp-cli  (or use this script with sharp)
 *
 * For now, this creates a minimal PNG that electron-builder can convert.
 * For production, replace build/icon.png with a proper 1024x1024 icon.
 *
 * electron-builder will auto-generate .icns (Mac) and .ico (Win) from icon.png
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.resolve(__dirname, '..', 'build')

if (!existsSync(buildDir)) {
  mkdirSync(buildDir, { recursive: true })
}

console.log(`
=== Icon Generation ===

electron-builder needs a 1024x1024 PNG icon at build/icon.png
It will auto-generate .icns (Mac) and .ico (Windows) from it.

To generate from the SVG logo, run one of:

  # Using sharp-cli
  npx sharp-cli -i public/logo.svg -o build/icon.png resize 1024 1024

  # Using Inkscape
  inkscape public/logo.svg -w 1024 -h 1024 -o build/icon.png

  # Using ImageMagick
  convert -background none public/logo.svg -resize 1024x1024 build/icon.png

  # Or use any image editor to create a 1024x1024 PNG

Place the file at: ${path.join(buildDir, 'icon.png')}
`)
