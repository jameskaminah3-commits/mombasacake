// Customers write M-Pesa numbers many ways (0712 345 678, +254 712 345 678, 712345678);
// orders store them as 254XXXXXXXXX, which is also what M-Pesa and review verification expect.
export function normalizeKenyanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
}

export function isValidKenyanMobile(value: string) {
  return /^254[17]\d{8}$/.test(value);
}
