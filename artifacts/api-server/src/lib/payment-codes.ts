import { and, desc, eq } from "drizzle-orm";
import { db, paymentsTable, type Order } from "@workspace/db";

// Payments rows for M-Pesa codes customers send after paying the till or paybill themselves:
// "reported" while the owner checks, then "completed" (Mark paid) or "rejected" (Code not found);
// "replaced" when the customer sent a corrected code.
export const CUSTOMER_CODE_METHOD = "mpesa-code";

// M-Pesa confirmation codes are 10 letters and numbers starting with a letter, like TJK3AB12CD. Customers can
// also paste the whole confirmation SMS, which starts with the code.
export function extractMpesaCode(input: string): string | null {
  const upper = input.toUpperCase();
  const compact = upper.replace(/[\s-]/g, "");
  if (/^[A-Z][A-Z0-9]{9}$/.test(compact)) return compact;
  return upper.match(/\b[A-Z][A-Z0-9]{9}\b/)?.[0] ?? null;
}

export type PaymentCheck = { code: string; state: "checking" | "not-found"; at: string };

// Where the customer's latest code stands, for their order page (nothing once the order is paid).
export async function paymentCheckFor(order: Pick<Order, "id" | "paymentStatus">): Promise<PaymentCheck | null> {
  if (order.paymentStatus === "paid") return null;
  const [latest] = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.orderId, order.id), eq(paymentsTable.method, CUSTOMER_CODE_METHOD)))
    .orderBy(desc(paymentsTable.createdAt), desc(paymentsTable.id))
    .limit(1);
  if (!latest?.mpesaReceiptNo || (latest.status !== "reported" && latest.status !== "rejected")) return null;
  return { code: latest.mpesaReceiptNo, state: latest.status === "reported" ? "checking" : "not-found", at: latest.createdAt.toISOString() };
}
