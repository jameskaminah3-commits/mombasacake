// Customers write M-Pesa numbers many ways (0712 345 678, +254 712 345 678, 712345678);
// orders store them as 254XXXXXXXXX, which is also what M-Pesa and review verification expect.
export function normalizeKenyanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
}

// The last nine digits, the same for every way of writing a number.
export const phoneKey = (value: string) => value.replace(/\D/g, "").slice(-9);

export function isValidKenyanMobile(value: string) {
  return /^254[17]\d{8}$/.test(value);
}

// 254712345678 → 0712 345 678, the way customers write their number.
export function displayKenyanPhone(value: string) {
  const normalized = normalizeKenyanPhone(value);
  if (!isValidKenyanMobile(normalized)) return value;
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
