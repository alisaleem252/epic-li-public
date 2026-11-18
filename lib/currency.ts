export function currencyFractionDigits(currency: string) {
  const code = /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD"

  const fractionDigits = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
  }).resolvedOptions().maximumFractionDigits

  return fractionDigits ?? 2
}

export function toMajorUnits(amountMinor: bigint, currency: string) {
  return Number(amountMinor) / 10 ** currencyFractionDigits(currency)
}

export function formatMinorCurrency(amountMinor: bigint, currency: string) {
  const code = /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD"
  const fractionDigits = currencyFractionDigits(code)

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: fractionDigits,
  }).format(toMajorUnits(amountMinor, code))
}
