const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isText = (value) => typeof value === 'string' && value.trim().length > 0

function validActionPlan(input) {
  return isRecord(input)
    && isText(input.title)
    && Array.isArray(input.steps)
    && input.steps.length >= 3
    && input.steps.length <= 5
    && input.steps.every(step => isRecord(step)
      && isText(step.text)
      && isText(step.detail)
      && isText(step.intentKey)
      && ['once', 'repeatable'].includes(step.completionPolicy))
}

function validGuide(input) {
  if (!isRecord(input) || typeof input.should_guide !== 'boolean') return false
  if (!input.should_guide) return true
  return isText(input.title)
    && isText(input.summary)
    && Array.isArray(input.steps)
    && input.steps.length >= 3
    && input.steps.length <= 6
    && input.steps.every(step => isRecord(step) && isText(step.text))
}

function validGoal(input) {
  if (!isRecord(input) || typeof input.should_suggest !== 'boolean') return false
  if (!input.should_suggest) return true
  return isText(input.name)
    && ['savings', 'investment'].includes(input.goal_type)
    && Number.isFinite(input.target_amount)
    && input.target_amount > 0
}

function validMemories(input) {
  return isRecord(input)
    && Array.isArray(input.memories)
    && input.memories.every(memory => isRecord(memory)
      && isText(memory.fact)
      && isText(memory.category)
      && isText(memory.memory_key)
      && isText(memory.subject_key))
}

function validHowTo(input) {
  return isRecord(input)
    && Array.isArray(input.steps)
    && input.steps.length >= 3
    && input.steps.length <= 6
    && input.steps.every(isText)
}

export function isCompleteToolResult(tool, input) {
  if (tool === 'action_plan') return validActionPlan(input)
  if (tool === 'guide') return validGuide(input)
  if (tool === 'suggest_goal') return validGoal(input)
  if (tool === 'extract_memories') return validMemories(input)
  if (tool === 'how_to') return validHowTo(input)
  return false
}

export function retryInstruction(tool) {
  if (tool === 'action_plan') {
    return 'Return a complete action plan with 3 to 5 distinct ordered steps. Every step must include text, detail, intentKey, and completionPolicy.'
  }
  if (tool === 'guide') {
    return 'Return the complete guide. If should_guide is true, include a title, summary, and 3 to 6 actionable steps.'
  }
  if (tool === 'suggest_goal') {
    return 'Return the complete goal suggestion. If should_suggest is true, include a specific name, goal_type, and positive target_amount.'
  }
  if (tool === 'how_to') return 'Return the complete how-to with 3 to 6 ordered steps.'
  return 'Return the complete structured result with every required field.'
}

export function sanitizeToolResult(tool, input) {
  if (tool !== 'guide' || !isRecord(input) || !Array.isArray(input.steps)) return input

  let remainingLinks = 3
  const seen = new Set()
  const steps = input.steps.map(step => {
    if (!isRecord(step) || !Array.isArray(step.resources)) return step
    const resources = []
    for (const resource of step.resources) {
      const url = typeof resource?.url === 'string' ? resource.url.trim() : ''
      if (remainingLinks <= 0 || !/^https:\/\//i.test(url) || seen.has(url)) continue
      seen.add(url)
      remainingLinks -= 1
      resources.push(resource)
    }
    return { ...step, resources }
  })
  return { ...input, steps }
}
