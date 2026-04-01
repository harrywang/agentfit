// Fetches pricing from LiteLLM's model pricing database (same source as ccusage)

const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

export interface ModelPricing {
  input_cost_per_token?: number
  output_cost_per_token?: number
  cache_creation_input_token_cost?: number
  cache_read_input_token_cost?: number
}

let pricingCache: Record<string, ModelPricing> | null = null

export async function loadPricing(): Promise<Record<string, ModelPricing>> {
  if (pricingCache) return pricingCache

  try {
    const res = await fetch(LITELLM_PRICING_URL, { next: { revalidate: 86400 } })
    const data = await res.json()
    // Filter to Claude/Anthropic models only
    const filtered: Record<string, ModelPricing> = {}
    for (const [key, value] of Object.entries(data)) {
      if (
        key.includes('claude') ||
        key.includes('anthropic')
      ) {
        const v = value as Record<string, unknown>
        filtered[key] = {
          input_cost_per_token: v.input_cost_per_token as number | undefined,
          output_cost_per_token: v.output_cost_per_token as number | undefined,
          cache_creation_input_token_cost: v.cache_creation_input_token_cost as number | undefined,
          cache_read_input_token_cost: v.cache_read_input_token_cost as number | undefined,
        }
      }
    }
    pricingCache = filtered
    return filtered
  } catch {
    // Fallback pricing if fetch fails
    return getFallbackPricing()
  }
}

function getFallbackPricing(): Record<string, ModelPricing> {
  return {
    'claude-opus-4-6': {
      input_cost_per_token: 15e-6,
      output_cost_per_token: 75e-6,
      cache_creation_input_token_cost: 18.75e-6,
      cache_read_input_token_cost: 1.5e-6,
    },
    'claude-sonnet-4-6': {
      input_cost_per_token: 3e-6,
      output_cost_per_token: 15e-6,
      cache_creation_input_token_cost: 3.75e-6,
      cache_read_input_token_cost: 0.3e-6,
    },
    'claude-haiku-4-5-20251001': {
      input_cost_per_token: 0.8e-6,
      output_cost_per_token: 4e-6,
      cache_creation_input_token_cost: 1e-6,
      cache_read_input_token_cost: 0.08e-6,
    },
  }
}

export function findPricing(
  model: string,
  allPricing: Record<string, ModelPricing>
): ModelPricing {
  // Try exact match
  if (allPricing[model]) return allPricing[model]

  // Try with anthropic/ prefix
  if (allPricing[`anthropic/${model}`]) return allPricing[`anthropic/${model}`]

  // Try partial match
  for (const [key, pricing] of Object.entries(allPricing)) {
    const normalizedKey = key.replace('anthropic/', '').replace('anthropic.', '')
    if (normalizedKey === model || normalizedKey.startsWith(model) || model.startsWith(normalizedKey)) {
      return pricing
    }
  }

  // Default to Sonnet pricing
  return allPricing['claude-sonnet-4-6'] || allPricing['anthropic/claude-sonnet-4-6'] || {
    input_cost_per_token: 3e-6,
    output_cost_per_token: 15e-6,
    cache_creation_input_token_cost: 3.75e-6,
    cache_read_input_token_cost: 0.3e-6,
  }
}

export function calculateCost(
  model: string,
  usage: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  },
  allPricing: Record<string, ModelPricing>
): number {
  const pricing = findPricing(model, allPricing)
  return (
    (usage.input_tokens || 0) * (pricing.input_cost_per_token || 0) +
    (usage.output_tokens || 0) * (pricing.output_cost_per_token || 0) +
    (usage.cache_creation_input_tokens || 0) * (pricing.cache_creation_input_token_cost || 0) +
    (usage.cache_read_input_tokens || 0) * (pricing.cache_read_input_token_cost || 0)
  )
}
