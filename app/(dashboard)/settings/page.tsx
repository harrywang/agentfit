'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'valid' | 'invalid' | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.hasOpenAIKey) {
          setMaskedKey(data.maskedKey)
          setSaved(true)
        }
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    if (!apiKey.trim()) return
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      if (res.ok) {
        setSaved(true)
        setMaskedKey(`${apiKey.trim().slice(0, 7)}...${apiKey.trim().slice(-4)}`)
        setTestResult(null)
      }
    } catch {
      // ignore
    }
  }

  async function handleClear() {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      })
      setApiKey('')
      setMaskedKey(null)
      setSaved(false)
      setTestResult(null)
    } catch {
      // ignore
    }
  }

  async function handleTest() {
    // Save first if not saved
    if (!saved && apiKey.trim()) await handleSave()

    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
      // 401 = no key or invalid key, 400 = key works (missing sessionId is expected)
      setTestResult(res.status === 401 ? 'invalid' : 'valid')
    } catch {
      setTestResult('invalid')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>AI Analysis</CardTitle>
              <CardDescription>
                Configure OpenAI API access for AI-powered message classification
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenAI API Key</label>
            {saved && !apiKey && maskedKey && (
              <p className="text-sm text-muted-foreground">
                Current key: <code className="text-xs">{maskedKey}</code>
              </p>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setSaved(false)
                    setTestResult(null)
                  }}
                  placeholder={saved ? 'Enter new key to replace...' : 'sk-...'}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={handleSave} disabled={!apiKey.trim() || saved} size="sm">
                Save
              </Button>
              {(apiKey || maskedKey) && (
                <Button onClick={handleClear} variant="outline" size="sm">
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleTest}
              variant="outline"
              size="sm"
              disabled={(!apiKey.trim() && !maskedKey) || testing}
            >
              {testing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Test Connection
            </Button>
            {testResult === 'valid' && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="mr-1 h-3 w-3" /> Valid
              </Badge>
            )}
            {testResult === 'invalid' && (
              <Badge variant="outline" className="text-destructive border-destructive">
                <XCircle className="mr-1 h-3 w-3" /> Invalid
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Your API key is stored in <code>~/.agentfit/config.json</code> on your machine and never
            leaves your local server. Used with gpt-4.1-mini (~$0.001 per 100 messages).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
