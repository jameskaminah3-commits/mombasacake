import { createHash, createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { customerAccountsTable, db, type CustomerAccount } from "@workspace/db";

// Customer sessions use their own key, so a customer's token can never pass as an admin one.
const CUSTOMER_SECRET = createHmac("sha256", process.env.SESSION_SECRET || "dev-only-session-secret")
  .update("customer-sessions")
  .digest("hex");
const SESSION_TTL = "90d";

type CustomerSessionPayload = { sub: string; email: string; kind: "customer" };

declare global {
  namespace Express {
    interface Request {
      customer?: CustomerAccount;
    }
  }
}

// Sign-in by emailed code only works when the shop can send email.
export function emailLoginAvailable() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function signCustomerSession(account: CustomerAccount) {
  const payload: CustomerSessionPayload = { sub: String(account.id), email: account.email, kind: "customer" };
  return jwt.sign(payload, CUSTOMER_SECRET, { expiresIn: SESSION_TTL });
}

export function hashLoginCode(email: string, code: string) {
  return createHash("sha256").update(`${CUSTOMER_SECRET}:${email}:${code}`).digest("hex");
}

// The signed-in customer, from the X-Customer-Token header (the admin's login uses the Authorization header).
export async function resolveCustomerFromRequest(req: Request): Promise<CustomerAccount | null> {
  const token = req.get("x-customer-token");
  if (!token) return null;
  try {
    const payload = jwt.verify(token, CUSTOMER_SECRET) as CustomerSessionPayload;
    if (payload.kind !== "customer") return null;
    const [account] = await db.select().from(customerAccountsTable).where(eq(customerAccountsTable.id, Number(payload.sub)));
    return account && account.email === payload.email ? account : null;
  } catch {
    return null;
  }
}

export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  resolveCustomerFromRequest(req)
    .then((account) => {
      if (!account) {
        res.status(401).json({ error: "Please sign in again" });
        return;
      }
      req.customer = account;
      next();
    })
    .catch(() => res.status(401).json({ error: "Please sign in again" }));
}
