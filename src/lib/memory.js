import { supabase } from '@/lib/supabase'

/**
 * Advisor Memory — durable facts the advisor remembers across sessions.
 * Table: advisor_memories (user_id, fact, category, created_at, updated_at)
 * RLS: user_id = auth.uid()
 */

const VALID_CATEGORIES = [
  'income', 'employment', 'life_event', 'risk_preference',
  'goal', 'debt', 'family', 'health', 'investment', 'other'
]

export function normalizeCategory(cat) {
  const c = (cat || 'other').toLowerCase().trim().replace(/\s+/g, '_')
  return VALID_CATEGORIES.includes(c) ? c : 'other'
}

function normalizeForDedup(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Create a new memory fact. Returns the created row or null.
 */
export async function createMemory(fact, category = 'other') {
  if (!fact || typeof fact !== 'string') return null
  const trimmed = fact.trim()
  if (!trimmed) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  try {
    const { data, error } = await supabase
      .from('advisor_memories')
      .insert({
        user_id: session.user.id,
        fact: trimmed,
        category: normalizeCategory(category),
      })
      .select()
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error('Error creating memory:', err)
    return null
  }
}

/**
 * Fetch all memories for the current user, newest first.
 */
export async function getMemories() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return []

  try {
    const { data, error } = await supabase
      .from('advisor_memories')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error('Error fetching memories:', err)
    return []
  }
}

/**
 * Delete a specific memory by its row id.
 */
export async function deleteMemory(memoryId) {
  try {
    const { error } = await supabase
      .from('advisor_memories')
      .delete()
      .eq('id', memoryId)
    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting memory:', err)
    return false
  }
}

/**
 * Check if a similar memory already exists. Returns the existing row or null.
 */
export function findSimilarMemory(newFact, existingMemories) {
  const normalizedNew = normalizeForDedup(newFact)
  if (!normalizedNew) return null

  for (const mem of existingMemories) {
    const normalizedExisting = normalizeForDedup(mem.fact)
    if (!normalizedExisting) continue

    if (normalizedExisting === normalizedNew) return mem
    // Substring containment check
    if (
      normalizedExisting.includes(normalizedNew) ||
      normalizedNew.includes(normalizedExisting)
    ) {
      return mem
    }
  }
  return null
}

/**
 * Deduplicate an array of memory objects by fact text.
 */
export function deduplicateMemories(memories) {
  const seen = new Set()
  return memories.filter((mem) => {
    const key = normalizeForDedup(mem.fact)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Format memories for injection into the LLM system prompt.
 * Groups by category, limits to the most recent 20.
 */
export function formatMemoriesForContext(memories) {
  if (!memories || memories.length === 0) return ''

  const recent = memories.slice(0, 20)
  const grouped = recent.reduce((acc, mem) => {
    const cat = mem.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(mem.fact)
    return acc
  }, {})

  const lines = ['KNOWN FROM PAST CONVERSATIONS:']
  for (const [category, facts] of Object.entries(grouped)) {
    lines.push(`  [${category.toUpperCase().replace(/_/g, ' ')}]`)
    facts.forEach((f) => lines.push(`    - ${f}`))
  }
  if (memories.length > 20) {
    lines.push(`  (…and ${memories.length - 20} older memories)`)
  }
  return lines.join('\n')
}

/**
 * Distill a conversation into durable memory facts using the LLM.
 * Returns an array of { fact, category } objects.
 */
export async function distillConversation(messages) {
  if (!messages || messages.length < 2) return []

  // Build a conversation transcript
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`)
    .join('\n\n')

  const prompt = `You are a memory extraction system. Read this conversation and extract 3–5 durable facts about the user's financial life that should be remembered for future conversations.

Rules:
- Only extract facts that are likely to remain true for months (income, employment, goals, debts, family changes, risk preferences, etc.)
- Do NOT extract transient things like "I'm feeling stressed today" or "the market is down"
- Return JSON only: { "memories": [{ "fact": "...", "category": "income|employment|life_event|risk_preference|goal|debt|family|health|investment|other" }] }
- If nothing durable was revealed, return { "memories": [] }

Conversation:
${transcript.slice(0, 8000)}`

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return []

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        system: 'You are a JSON-only memory extraction system.',
        maxTokens: 512,
        tool: 'extract_memories',
      }),
    })

    if (!res.ok) {
      // Log the real upstream reason (429/529/etc.) instead of failing silent
      // and unexplained — this is a background call, so we still degrade
      // gracefully to [], but future debugging shouldn't require re-deriving
      // this from network tab archaeology.
      console.warn(`Memory distill failed (${res.status}):`, await res.text().catch(() => ''))
      return []
    }
    const data = await res.json()
    const memories = data?.memories || data?.result?.memories || []
    return Array.isArray(memories) ? memories : []
  } catch (err) {
    console.error('Error distilling conversation:', err)
    return []
  }
}

