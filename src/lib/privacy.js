const MONEY_PATTERN = /-?\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:\/\s?(?:mo|month|yr|year)|per\s+(?:month|year)))?/gi

export function maskMoneyText(value, hidden, replacement = 'amount hidden') {
  const text = value == null ? '' : String(value)
  return hidden ? text.replace(MONEY_PATTERN, replacement) : text
}

export function privateMoney(value, hidden, formatter) {
  return hidden ? 'Amount hidden' : formatter(value)
}
