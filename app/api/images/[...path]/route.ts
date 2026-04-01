import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const IMAGES_DIR = path.resolve(process.cwd(), 'data', 'images')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  const filePath = path.join(IMAGES_DIR, ...segments)

  // Prevent directory traversal
  if (!filePath.startsWith(IMAGES_DIR)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).slice(1)
  const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
