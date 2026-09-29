// Customers write Kenyan numbers many ways (0712 345 678, +254 712 345 678, 712345678); the shop stores 2547XXXXXXXX.
export function normalizeKenyanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
}

// The last 9 digits identify a Kenyan mobile number whichever way it was written.
export function phoneKey(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").slice(-9);
}
