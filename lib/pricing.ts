// Fetches pricing from LiteLLM's model pricing database (same source as ccusage).
// Tiered (>200k) pricing and the speed=fast multiplier are ported from ccusage
// (MIT, © 2025 ryoppippi) — see packages/internal/src/pricing.ts in that repo.

import fs from 'fs'
import path from 'path'

const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

const TIERED_THRESHOLD = 200_000

// Node's fetch has no default timeout. On a network that can't reach
// raw.githubusercontent.com the request hangs for minutes and every sync
// silently falls back to the hardcoded table below.
const FETCH_TIMEOUT_MS = 15_000

// Last known-good LiteLLM snapshot, written on every successful fetch and
// read back when the fetch fails. Keeps a blocked or offline machine on real
// prices instead of the hand-maintained fallback, which always lags new models.
const PRICING_CACHE_FILE = path.resolve(process.cwd(), 'data', 'pricing.json')

export interface ModelPricing {
  input_cost_per_token?: number
  output_cost_per_token?: number
  cache_creation_input_token_cost?: number
  cache_read_input_token_cost?: number
  // 1M-context tiered prices (Claude/Anthropic only)
  input_cost_per_token_above_200k_tokens?: number
  output_cost_per_token_above_200k_tokens?: number
  cache_creation_input_token_cost_above_200k_tokens?: number
  cache_read_input_token_cost_above_200k_tokens?: number
  provider_specific_entry?: { fast?: number }
}

export type Speed = 'standard' | 'fast'

let pricingCache: Record<string, ModelPricing> | null = null

export async function loadPricing(): Promise<Record<string, ModelPricing>> {
  if (pricingCache) return pricingCache

  try {
    // Bypass Next's data cache; we memoize the parsed result in
    // `pricingCache` ourselves. Double-caching once let an empty body
    // freeze every newly-listed model at cost=0 until process restart.
    const res = await fetch(LITELLM_PRICING_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`LiteLLM pricing fetch failed: ${res.status}`)
    const data = await res.json()
    const filtered = extractClaudePricing(data as Record<string, unknown>)
    // Refuse to memoize an empty map — that would be a transient fetch
    // hiccup turning into a process-lifetime zero-cost lock.
    if (Object.keys(filtered).length === 0) return loadOfflinePricing()
    writePricingCacheFile(filtered)
    pricingCache = filtered
    return filtered
  } catch {
    return loadOfflinePricing()
  }
}

function extractClaudePricing(data: Record<string, unknown>): Record<string, ModelPricing> {
  const filtered: Record<string, ModelPricing> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!key.includes('claude') && !key.includes('anthropic')) continue
    const v = value as Record<string, unknown>
    filtered[key] = {
      input_cost_per_token: v.input_cost_per_token as number | undefined,
      output_cost_per_token: v.output_cost_per_token as number | undefined,
      cache_creation_input_token_cost: v.cache_creation_input_token_cost as number | undefined,
      cache_read_input_token_cost: v.cache_read_input_token_cost as number | undefined,
      input_cost_per_token_above_200k_tokens: v.input_cost_per_token_above_200k_tokens as
        | number
        | undefined,
      output_cost_per_token_above_200k_tokens: v.output_cost_per_token_above_200k_tokens as
        | number
        | undefined,
      cache_creation_input_token_cost_above_200k_tokens:
        v.cache_creation_input_token_cost_above_200k_tokens as number | undefined,
      cache_read_input_token_cost_above_200k_tokens:
        v.cache_read_input_token_cost_above_200k_tokens as number | undefined,
      provider_specific_entry:
        v.provider_specific_entry && typeof v.provider_specific_entry === 'object'
          ? { fast: (v.provider_specific_entry as Record<string, unknown>).fast as number | undefined }
          : undefined,
    }
  }
  return filtered
}

function writePricingCacheFile(pricing: Record<string, ModelPricing>): void {
  try {
    fs.mkdirSync(path.dirname(PRICING_CACHE_FILE), { recursive: true })
    fs.writeFileSync(PRICING_CACHE_FILE, JSON.stringify(pricing), 'utf8')
  } catch {
    // A read-only install dir just means we keep using the hardcoded table.
  }
}

// Used whenever the live fetch fails. The on-disk snapshot is preferred over
// the hardcoded table because the table only knows the models that existed
// when it was last edited — the exact failure that zero-costs a new model.
// Not memoized into `pricingCache`: the next call should retry the network.
function loadOfflinePricing(): Record<string, ModelPricing> {
  try {
    const raw = fs.readFileSync(PRICING_CACHE_FILE, 'utf8')
    const cached = JSON.parse(raw) as Record<string, ModelPricing>
    if (cached && Object.keys(cached).length > 0) return cached
  } catch {
    // No usable snapshot yet.
  }
  return getFallbackPricing()
}

function getFallbackPricing(): Record<string, ModelPricing> {
  // Last-resort table, used only when the LiteLLM fetch fails and no
  // `data/pricing.json` snapshot exists. Mirrors LiteLLM as of 2026-09-11.
  // Add every newly released model here — a missing entry means findPricing
  // returns null and calculateCost silently reports $0 for real usage.
  const opus = {
    input_cost_per_token: 5e-6,
    output_cost_per_token: 25e-6,
    cache_creation_input_token_cost: 6.25e-6,
    cache_read_input_token_cost: 0.5e-6,
  }
  return {
    'claude-opus-5': { ...opus, provider_specific_entry: { fast: 2 } },
    'claude-opus-4-8': { ...opus, provider_specific_entry: { fast: 2 } },
    'claude-opus-4-7': { ...opus },
    'claude-opus-4-6': { ...opus },
    'claude-fable-5': {
      input_cost_per_token: 10e-6,
      output_cost_per_token: 50e-6,
      cache_creation_input_token_cost: 12.5e-6,
      cache_read_input_token_cost: 1e-6,
    },
    'claude-fable-5-1': {
      input_cost_per_token: 10e-6,
      output_cost_per_token: 50e-6,
      cache_creation_input_token_cost: 12.5e-6,
      cache_read_input_token_cost: 0.25e-6,
    },
    'claude-sonnet-5': {
      input_cost_per_token: 2e-6,
      output_cost_per_token: 10e-6,
      cache_creation_input_token_cost: 2.5e-6,
      cache_read_input_token_cost: 0.2e-6,
    },
    'claude-sonnet-4-6': {
      input_cost_per_token: 3e-6,
      output_cost_per_token: 15e-6,
      cache_creation_input_token_cost: 3.75e-6,
      cache_read_input_token_cost: 0.3e-6,
    },
    'claude-haiku-4-5-20251001': {
      input_cost_per_token: 1e-6,
      output_cost_per_token: 5e-6,
      cache_creation_input_token_cost: 1.25e-6,
      cache_read_input_token_cost: 0.1e-6,
    },
  }
}

export function findPricing(
  model: string,
  allPricing: Record<string, ModelPricing>
): ModelPricing | null {
  if (allPricing[model]) return allPricing[model]
  if (allPricing[`anthropic/${model}`]) return allPricing[`anthropic/${model}`]

  for (const [key, pricing] of Object.entries(allPricing)) {
    const normalizedKey = key.replace('anthropic/', '').replace('anthropic.', '')
    if (
      normalizedKey === model ||
      normalizedKey.startsWith(model) ||
      model.startsWith(normalizedKey)
    ) {
      return pricing
    }
  }

  // Substring fallback (mirrors ccusage's behaviour at packages/internal/src/pricing.ts:232-238)
  const lower = model.toLowerCase()
  for (const [key, pricing] of Object.entries(allPricing)) {
    const k = key.toLowerCase()
    if (k.includes(lower) || lower.includes(k)) return pricing
  }

  return null
}

function tieredCost(
  total: number | undefined,
  base: number | undefined,
  tiered: number | undefined
): number {
  if (total == null || total <= 0) return 0
  if (total > TIERED_THRESHOLD && tiered != null) {
    const below = Math.min(total, TIERED_THRESHOLD)
    const above = Math.max(0, total - TIERED_THRESHOLD)
    return above * tiered + (base != null ? below * base : 0)
  }
  return base != null ? total * base : 0
}

export function calculateCost(
  model: string,
  usage: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  },
  allPricing: Record<string, ModelPricing>,
  speed: Speed = 'standard'
): number {
  const pricing = findPricing(model, allPricing)
  if (!pricing) return 0

  const base =
    tieredCost(
      usage.input_tokens,
      pricing.input_cost_per_token,
      pricing.input_cost_per_token_above_200k_tokens
    ) +
    tieredCost(
      usage.output_tokens,
      pricing.output_cost_per_token,
      pricing.output_cost_per_token_above_200k_tokens
    ) +
    tieredCost(
      usage.cache_creation_input_tokens,
      pricing.cache_creation_input_token_cost,
      pricing.cache_creation_input_token_cost_above_200k_tokens
    ) +
    tieredCost(
      usage.cache_read_input_tokens,
      pricing.cache_read_input_token_cost,
      pricing.cache_read_input_token_cost_above_200k_tokens
    )

  const multiplier = speed === 'fast' ? pricing.provider_specific_entry?.fast ?? 1 : 1
  return base * multiplier
}
