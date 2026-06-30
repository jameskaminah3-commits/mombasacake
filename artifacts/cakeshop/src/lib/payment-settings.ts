import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

export type PaymentSettings = {
  provider: "mpesa";
  displayName: string;
  businessShortCode: string;
  tillNumber: string;
  transactionType: string;
  accountReferencePrefix: string;
  instructions: string;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  provider: "mpesa",
  displayName: "MPesa",
  businessShortCode: "174379",
  tillNumber: "",
  transactionType: "CustomerPayBillOnline",
  accountReferencePrefix: "Order",
  instructions:
    "You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen.",
};

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  try {
    const data = await customFetch<Partial<PaymentSettings>>(
      `${getApiBaseUrl()}/api/payment-settings`
    );
    return { ...DEFAULT_PAYMENT_SETTINGS, ...data };
  } catch {
    return DEFAULT_PAYMENT_SETTINGS;
  }
}

export async function savePaymentSettings(settings: PaymentSettings): Promise<PaymentSettings> {
  const data = await customFetch<Partial<PaymentSettings>>(
    `${getApiBaseUrl()}/api/payment-settings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }
  );
  return { ...DEFAULT_PAYMENT_SETTINGS, ...data };
}
