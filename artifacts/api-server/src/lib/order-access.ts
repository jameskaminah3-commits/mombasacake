import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type { CustomerAccount } from "@workspace/db";
import { resolveAdminFromBearerToken } from "./admin-auth";
import { resolveCustomerFromRequest } from "./customer-auth";
import { phoneKey } from "./phone";

export function newOrderAccessToken() {
  return randomBytes(18).toString("base64url");
}

function sameSecret(given: string, expected: string) {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function fromHeaderOrQuery(req: Request, header: string, query: string) {
  const value = req.get(header) ?? (typeof req.query[query] === "string" ? req.query[query] : undefined);
  return value?.trim() || null;
}

// Wrong phone numbers per visitor in the last hour (in memory; resets on restart), so nobody can try
// someone's number against order after order.
const MAX_WRONG_PHONES_PER_HOUR = 30;
const wrongPhones = new Map<string, number[]>();
function recentWrongPhones(visitor: string) {
  const now = Date.now();
  return (wrongPhones.get(visitor) ?? []).filter((time) => now - time < 60 * 60_000);
}
const tooManyWrongPhones = (req: Request) => recentWrongPhones(req.ip ?? "unknown").length >= MAX_WRONG_PHONES_PER_HOUR;
function noteWrongPhone(req: Request) {
  if (wrongPhones.size > 10_000) wrongPhones.clear();
  const visitor = req.ip ?? "unknown";
  wrongPhones.set(visitor, [...recentWrongPhones(visitor), Date.now()]);
}

type OrderOwnerFields = { accessToken: string | null; customerPhone: string; customerEmail: string | null };

// A signed-in customer's orders are the ones placed with their (verified) email address.
export function accountOwnsOrder(account: CustomerAccount, order: OrderOwnerFields) {
  return !!order.customerEmail && order.customerEmail.trim().toLowerCase() === account.email.toLowerCase();
}

// Who may see or pay an order: anyone with its private link, someone who knows the phone number it was
// placed with (for links from before private codes), the signed-in customer it belongs to, or the owner.
export async function canAccessOrder(req: Request, order: OrderOwnerFields): Promise<boolean> {
  const token = fromHeaderOrQuery(req, "x-order-token", "token");
  if (token && order.accessToken && sameSecret(token, order.accessToken)) return true;

  const phone = fromHeaderOrQuery(req, "x-order-phone", "phone");
  if (phone && phoneKey(phone).length === 9 && !tooManyWrongPhones(req)) {
    if (phoneKey(phone) === phoneKey(order.customerPhone)) return true;
    noteWrongPhone(req);
  }

  const account = await resolveCustomerFromRequest(req);
  if (account && accountOwnsOrder(account, order)) return true;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const admin = await resolveAdminFromBearerToken(authHeader.slice(7)).catch(() => null);
    if (admin) return true;
  }
  return false;
}
