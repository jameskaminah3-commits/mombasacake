import { createHmac, timingSafeEqual } from "node:crypto";
import axios from "axios";
import { logger } from "./logger";

// Safaricom's payment notifications come to public addresses, so each address carries a secret key and
// notifications without it are ignored (anyone could otherwise post a fake "payment received").
const CALLBACK_KEY = createHmac("sha256", process.env.SESSION_SECRET || "dev-only-session-secret")
  .update("mpesa-callbacks")
  .digest("hex")
  .slice(0, 32);

function withCallbackKey(address: string) {
  const url = new URL(address);
  url.searchParams.set("key", CALLBACK_KEY);
  return url.toString();
}

export function isValidCallbackKey(value: unknown) {
  if (typeof value !== "string" || value.length !== CALLBACK_KEY.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(CALLBACK_KEY));
}

const LIVE = process.env.MPESA_ENV === "production";
const MPESA_BASE_URL = LIVE ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
// Safaricom's test shortcode only works with their sandbox; live payments always use the shop's own number.
const SANDBOX_FALLBACK = LIVE ? "" : "174379";

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

// One-time registration of the C2B Validation/Confirmation URLs with Safaricom
// so that EVERY payment to the till (including ones the customer makes manually
// via Buy Goods, not just app-initiated STK pushes) is POSTed to our server.
// `shopShortcode`: the paybill number, or the till's store / head office number, from Admin → Payments.
export async function registerC2bUrls(shopShortcode?: string | null): Promise<unknown> {
  const shortcode = shopShortcode || process.env.MPESA_SHORTCODE || SANDBOX_FALLBACK;
  if (!shortcode) throw new Error("No paybill or store number set");
  const base =
    process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://example.com";

  const token = await getAccessToken();
  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/c2b/v1/registerurl`,
    {
      ShortCode: shortcode,
      ResponseType: "Completed",
      ConfirmationURL: withCallbackKey(`${base}/api/payments/mpesa/c2b/confirmation`),
      ValidationURL: `${base}/api/payments/mpesa/c2b/validation`,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

export interface StkPushParams {
  phone: string;
  amount: number;
  orderId: number;
  callbackUrl?: string;
  // Operational config, normally sourced from the admin payment settings.
  // Falls back to env vars, then (sandbox only) to Safaricom's test shortcode.
  shortcode?: string;
  transactionType?: string;
  tillNumber?: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseDescription: string;
  responseCode: string;
}

export async function initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
  // For a PayBill, the shortcode is the PayBill number and PartyB is the same.
  // For a Till (Buy Goods), the shortcode is the Store / Head Office number used
  // to authenticate and sign the password, while PartyB is the customer-facing
  // Till number. Set MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline and
  // MPESA_TILL_NUMBER to operate against a Till.
  const shortcode = params.shortcode || process.env.MPESA_SHORTCODE || SANDBOX_FALLBACK;
  const passkey = process.env.MPESA_PASSKEY || "";
  const transactionType =
    params.transactionType || process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline";
  const tillNumber = params.tillNumber || process.env.MPESA_TILL_NUMBER || "";
  const isBuyGoods = transactionType === "CustomerBuyGoodsOnline";
  const partyB = isBuyGoods && tillNumber ? tillNumber : shortcode;

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .substring(0, 14);

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  // Normalize phone: strip leading + or 0 to 254XXXXXXXXX.
  let phone = params.phone.replace(/\s+/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`;

  const callbackUrl = withCallbackKey(
    process.env.MPESA_CALLBACK_URL ||
      `${process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://example.com"}/api/payments/mpesa/callback`,
  );

  try {
    if (!shortcode) throw new Error("No paybill or store number set for the M-Pesa prompt");
    const token = await getAccessToken();

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: transactionType,
        Amount: Math.ceil(params.amount),
        PartyA: phone,
        PartyB: partyB,
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
    // Tests only (MPESA_MOCK=1): pretend the prompt was sent. Real customers never get a fake prompt.
    if (process.env.MPESA_MOCK === "1") {
      return {
        checkoutRequestId: `mock-cid-${Date.now()}`,
        merchantRequestId: `mock-mid-${Date.now()}`,
        responseDescription: "Success (mock - MPesa not configured)",
        responseCode: "0",
      };
    }
    throw err;
  }
}
