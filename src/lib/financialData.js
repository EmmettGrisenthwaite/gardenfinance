const RECORDS = [
  ['accounts', 'accounts', ['created_at']],
  ['debts', 'debts', ['created_at']],
  ['goals', 'goals', ['created_at']],
  ['cashFlowItems', 'cash_flow_items', ['sort_order', 'created_at']],
  ['budgetLimits', 'budget_limits', ['category']],
]

// A financial picture is either complete or unavailable. Never substitute an
// empty account/debt list for a failed read: downstream calculations also feed
// saved snapshots and personalized recommendations.
export async function loadFinancialRecords(client, userId) {
  if (!userId) throw new Error('Sign in to load your financial records.')
  const entries = await Promise.all(RECORDS.map(async ([key, table, order]) => {
    let query = client.from(table).select('*').eq('user_id', userId)
    for (const column of order) query = query.order(column)
    const { data, error } = await query
    if (error) throw error
    if (!Array.isArray(data)) throw new Error('Financial records returned an incomplete response. Please try again.')
    return [key, data]
  }))
  return Object.fromEntries(entries)
}
