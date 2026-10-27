const digitsCache = new Map<string, number>();

/**
 * How many decimals a currency uses (2 for USD, 0 for JPY...).
 */
export function currencyDigits(currency: string): number {
  const code = currency.toUpperCase();
  let digits = digitsCache.get(code);
  if (digits === undefined) {
    digits = new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2;
    digitsCache.set(code, digits);
  }
  return digits;
}

export function toMajor(amount: number, currency: string): number {
  return amount / 10 ** currencyDigits(currency);
}

export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyDigits(currency));
}

/**
 * Formats an amount stored in minor units (cents) as a price string.
 */
export function formatMoney(amount: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(toMajor(amount, currency));
}
