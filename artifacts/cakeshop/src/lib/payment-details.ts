import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

// How customers pay, from Admin → Payments. `manual.number` (the till or paybill) is null until the owner has set a
// real one; `stkEnabled` says whether the shop also sends an M-Pesa prompt to the customer's phone.
export type PaymentDetails = {
  displayName: string;
  transactionType: string;
  instructions: string;
  stkEnabled: boolean;
  manual: { method: "till" | "paybill"; number: string | null; accountReferencePrefix: string };
};

export async function fetchPaymentDetails(): Promise<PaymentDetails> {
  const response = await fetch(`${getApiBaseUrl()}/api/payment-details`);
  if (!response.ok) throw new Error("Payment details are unavailable");
  return response.json();
}

export function usePaymentDetails() {
  return useQuery({ queryKey: ["payment-details"], queryFn: fetchPaymentDetails, staleTime: 60_000, retry: 2 });
}

// M-Pesa confirmation codes are 10 letters and numbers starting with a letter, like TJK3AB12CD. Customers can
// paste the whole confirmation SMS, which starts with the code.
export function extractMpesaCode(input: string): string | null {
  const upper = input.toUpperCase();
  const compact = upper.replace(/[\s-]/g, "");
  if (/^[A-Z][A-Z0-9]{9}$/.test(compact)) return compact;
  return upper.match(/\b[A-Z][A-Z0-9]{9}\b/)?.[0] ?? null;
}

export function sendPaymentCode(orderId: number, code: string, headers: Record<string, string>) {
  return customFetch<unknown>(`${getApiBaseUrl()}/api/orders/${orderId}/payment-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ code }),
  });
}
