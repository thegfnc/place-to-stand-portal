/**
 * US Phone number formatting utilities
 * Format: (XXX) XXX-XXXX
 */

/**
 * Formats a phone number string to US format: (XXX) XXX-XXXX
 * Only accepts digits, strips all other characters
 */
export function formatPhoneUS(value: string): string {
  // Strip all non-digits and limit to 10
  const digits = value.replace(/\D/g, '').slice(0, 10)

  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Extracts raw digits from a formatted phone string
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10)
}
