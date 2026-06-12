import { getApiBaseUrl } from "@/lib/api-base";
import { DEFAULT_PAYMENT_SETTINGS, type PaymentSettings } from "./payment-settings";

export type PaymentDetails = PaymentSettings;

export const DEFAULT_PAYMENT_DETAILS: PaymentDetails = DEFAULT_PAYMENT_SETTINGS;

export async function fetchPaymentDetails(): Promise<PaymentDetails> {
  const response = await fetch(`${getApiBaseUrl()}/api/payment-details`);
  if (!response.ok) {
    return DEFAULT_PAYMENT_DETAILS;
  }

  const data = (await response.json()) as Partial<PaymentDetails>;
  return {
    ...DEFAULT_PAYMENT_DETAILS,
    ...data,
  };
}
