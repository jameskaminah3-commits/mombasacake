import { getApiBaseUrl } from "@/lib/api-base";

export type PaymentSettings = {
  provider: "mpesa";
  displayName: string;
  businessShortCode: string;
  transactionType: string;
  accountReferencePrefix: string;
  instructions: string;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  provider: "mpesa",
  displayName: "MPesa",
  businessShortCode: "174379",
  transactionType: "CustomerPayBillOnline",
  accountReferencePrefix: "Order",
  instructions:
    "You will receive an MPesa prompt on your phone after clicking Pay. If the prompt does not arrive, use the business shortcode and order reference shown in the checkout screen.",
};

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  const response = await fetch(`${getApiBaseUrl()}/api/payment-settings`);
  if (!response.ok) {
    return DEFAULT_PAYMENT_SETTINGS;
  }

  const data = (await response.json()) as Partial<PaymentSettings>;
  return {
    ...DEFAULT_PAYMENT_SETTINGS,
    ...data,
  };
}

export async function savePaymentSettings(settings: PaymentSettings): Promise<PaymentSettings> {
  const response = await fetch(`${getApiBaseUrl()}/api/payment-settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to save payment settings");
  }

  const data = (await response.json()) as Partial<PaymentSettings>;
  return {
    ...DEFAULT_PAYMENT_SETTINGS,
    ...data,
  };
}
