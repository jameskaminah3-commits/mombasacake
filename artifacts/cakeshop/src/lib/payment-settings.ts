import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

// Admin → Payments. `stkSetting` is the owner's switch for the M-Pesa prompt; `stkConfigured` says whether the
// server has the M-Pesa (Daraja) keys the prompt needs, `darajaKeys` whether it can ask Safaricom for payment
// notifications.
export type PaymentSettings = {
  displayName: string;
  businessShortCode: string;
  tillNumber: string;
  transactionType: string;
  accountReferencePrefix: string;
  instructions: string;
  stkEnabled: boolean;
};
export type AdminPaymentSettings = PaymentSettings & { stkSetting: boolean; stkConfigured: boolean; darajaKeys: boolean };

export function fetchPaymentSettings() {
  return customFetch<AdminPaymentSettings>(`${getApiBaseUrl()}/api/payment-settings`);
}

export function savePaymentSettings(settings: PaymentSettings) {
  return customFetch<AdminPaymentSettings>(`${getApiBaseUrl()}/api/payment-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}
