import axios from "axios";
import { logger } from "./logger";

const MPESA_BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

async function getAccessToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("MPesa credentials not configured");
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const response = await axios.get(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  return response.data.access_token;
}

export interface StkPushParams {
  phone: string;
  amount: number;
  orderId: number;
  callbackUrl?: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseDescription: string;
  responseCode: string;
}

export async function initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
  const shortcode = process.env.MPESA_SHORTCODE || "174379";
  const passkey = process.env.MPESA_PASSKEY || "";

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .substring(0, 14);

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  // Normalize phone: strip leading + or 0 → 254XXXXXXXXX
  let phone = params.phone.replace(/\s+/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`;

  const callbackUrl =
    process.env.MPESA_CALLBACK_URL ||
    `${process.env.REPLIT_DOMAINS?.split(",")[0] ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://example.com"}/api/payments/mpesa/callback`;

  try {
    const token = await getAccessToken();

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(params.amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: `Order-${params.orderId}`,
        TransactionDesc: `Cake order #${params.orderId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      checkoutRequestId: response.data.CheckoutRequestID,
      merchantRequestId: response.data.MerchantRequestID,
      responseDescription: response.data.ResponseDescription,
      responseCode: response.data.ResponseCode,
    };
  } catch (err: unknown) {
    logger.error({ err }, "MPesa STK push failed");
    // Return a mock response for sandbox/dev when credentials aren't set
    if (!process.env.MPESA_CONSUMER_KEY) {
      return {
        checkoutRequestId: `mock-cid-${Date.now()}`,
        merchantRequestId: `mock-mid-${Date.now()}`,
        responseDescription: "Success (mock — MPesa not configured)",
        responseCode: "0",
      };
    }
    throw err;
  }
}
