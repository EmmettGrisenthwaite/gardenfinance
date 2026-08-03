// Maps Plaid's account/liability shapes onto Garden Financial's accounts/debts
// row shape. Plain, dependency-free ESM so it can be imported unchanged by a
// Deno edge function (relative import) and by the Node test runner.
//
// Garden Financial's own type system (src/lib/moneyModel.js) is the target:
//   accounts.type      'checking' | 'savings' | 'brokerage' | 'property' | 'vehicle' | 'other_asset'
//   accounts.subtype   CASH_SUBTYPES | INVESTMENT_SUBTYPES | ASSET_SUBTYPES value
//   debts.type         DEBT_TYPES value
//
// Plaid's taxonomy (its `type`/`subtype` pair per account) is richer and
// looser than ours, so this is a many-to-one mapping with sensible fallbacks
// rather than a strict lookup table — an unrecognized investment subtype
// still lands as an investment account, never silently dropped.

const num = value => (value === null || value === undefined ? null : Number(value))

const CASH_SUBTYPE_MAP = {
  checking: 'checking',
  savings: 'standard_savings',
  cd: 'cd',
  'money market': 'money_market',
  prepaid: 'cash',
  'cash management': 'cash',
}

// Plaid puts HSAs under either `depository` or `investment` depending on the
// institution; our schema only models HSA as an investment subtype, so it's
// special-cased ahead of the depository/investment split below.
const INVESTMENT_SUBTYPE_MAP = {
  hsa: 'hsa',
  '401k': '401k',
  'roth 401k': '401k',
  '403b': '403b',
  ira: 'traditional_ira',
  roth: 'roth_ira',
  'sep ira': 'sep_ira',
  'simple ira': 'sep_ira',
  keogh: 'traditional_ira',
  brokerage: 'taxable_brokerage',
  'non-taxable brokerage account': 'taxable_brokerage',
  crypto: 'crypto',
}

function findApr(aprs, aprType) {
  const match = (aprs || []).find(entry => entry.apr_type === aprType) || (aprs || [])[0]
  return num(match?.apr_percentage)
}

// `liabilityByAccount` is a Map<account_id, liability-detail-object> built by
// the caller from /liabilities/get's three arrays (credit, mortgage, student)
// keyed by account_id — see indexLiabilities() below.
export function mapPlaidAccount(plaidAccount, { institutionName = null, liabilityByAccount = new Map() } = {}) {
  const type = String(plaidAccount?.type || '').toLowerCase()
  const subtype = String(plaidAccount?.subtype || '').toLowerCase()
  const balances = plaidAccount?.balances || {}
  const name = plaidAccount?.name || plaidAccount?.official_name || 'Account'
  const liability = liabilityByAccount.get(plaidAccount?.account_id) || null

  const shared = {
    plaid_account_id: plaidAccount?.account_id,
    source: 'plaid',
    last_synced_at: new Date().toISOString(),
  }

  // ── Credit cards → debt ──────────────────────────────────────────────
  if (type === 'credit') {
    return {
      table: 'debts',
      row: {
        ...shared,
        name,
        type: 'credit_card',
        lender: institutionName,
        balance: num(balances.current) ?? 0,
        interest_rate: findApr(liability?.aprs, 'purchase_apr'),
        minimum_payment: num(liability?.minimum_payment_amount),
        credit_limit: num(balances.limit),
        include_in_net_worth: true,
      },
    }
  }

  // ── Loans → debt ─────────────────────────────────────────────────────
  if (type === 'loan') {
    if (subtype === 'mortgage') {
      return {
        table: 'debts',
        row: {
          ...shared,
          name,
          type: 'mortgage',
          lender: institutionName,
          balance: num(balances.current) ?? 0,
          interest_rate: num(liability?.interest_rate?.percentage),
          minimum_payment: num(liability?.next_monthly_payment),
          original_balance: num(liability?.origination_principal_amount),
          term_end_date: liability?.maturity_date || null,
          include_in_net_worth: true,
        },
      }
    }
    if (subtype === 'student') {
      return {
        table: 'debts',
        row: {
          ...shared,
          name,
          type: 'student_loan',
          lender: liability?.loan_name || institutionName,
          balance: num(balances.current) ?? 0,
          interest_rate: num(liability?.interest_rate_percentage),
          minimum_payment: num(liability?.minimum_payment_amount),
          original_balance: num(liability?.origination_principal_amount),
          include_in_net_worth: true,
        },
      }
    }
    const debtType = subtype === 'auto' ? 'auto_loan' : subtype === 'home equity' ? 'other' : 'personal_loan'
    return {
      table: 'debts',
      row: {
        ...shared,
        name, type: debtType, lender: institutionName,
        balance: num(balances.current) ?? 0,
        include_in_net_worth: true,
      },
    }
  }

  // ── Depository → cash account ───────────────────────────────────────
  if (type === 'depository' && subtype !== 'hsa') {
    const mappedSubtype = CASH_SUBTYPE_MAP[subtype] || 'cash'
    return {
      table: 'accounts',
      row: {
        ...shared,
        name,
        institution: institutionName,
        type: mappedSubtype === 'checking' ? 'checking' : 'savings',
        subtype: mappedSubtype,
        balance: num(balances.current ?? balances.available) ?? 0,
        include_in_net_worth: true,
      },
    }
  }

  // ── Investment (and HSAs of any Plaid type) → investment account ─────
  if (type === 'investment' || subtype === 'hsa') {
    return {
      table: 'accounts',
      row: {
        ...shared,
        name,
        institution: institutionName,
        type: 'brokerage',
        subtype: INVESTMENT_SUBTYPE_MAP[subtype] || 'other_investment',
        balance: num(balances.current) ?? 0,
        include_in_net_worth: true,
      },
    }
  }

  // ── Anything else Plaid returns → tracked as a generic asset rather
  //     than silently dropped, so net worth still reflects it.
  return {
    table: 'accounts',
    row: {
      ...shared,
      name,
      institution: institutionName,
      type: 'other_asset',
      subtype: 'other_asset',
      balance: num(balances.current) ?? 0,
      include_in_net_worth: true,
    },
  }
}

// Builds account_id → liability-detail lookup from /liabilities/get's
// { credit: [], mortgage: [], student: [] } response.
export function indexLiabilities(liabilities = {}) {
  const map = new Map()
  for (const key of ['credit', 'mortgage', 'student']) {
    for (const entry of liabilities?.[key] || []) {
      if (entry?.account_id) map.set(entry.account_id, entry)
    }
  }
  return map
}

// Maps every account from /accounts/get (or /liabilities/get, same shape)
// into { accounts: [...], debts: [...] } rows ready to upsert.
export function mapPlaidAccounts(plaidAccounts = [], { institutionName = null, liabilities = {} } = {}) {
  const liabilityByAccount = indexLiabilities(liabilities)
  const accounts = []
  const debts = []
  for (const plaidAccount of plaidAccounts) {
    const { table, row } = mapPlaidAccount(plaidAccount, { institutionName, liabilityByAccount })
    if (table === 'debts') debts.push(row)
    else accounts.push(row)
  }
  return { accounts, debts }
}
