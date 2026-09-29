import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

// What the shop remembers for a customer lives in this browser only. Storage can be missing or full
// (private windows, cleared data), so every read and write here copes with that.
const DETAILS_KEY = "channah-customer-details";
const ORDERS_KEY = "channah-orders";
const REFERRAL_KEY = "channah-referral-code";
const SESSION_KEY = "channah-customer-session";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered; everything still works for this visit.
  }
}

// Checkout details, filled in again next time.
export type SavedDetails = { customerName: string; customerPhone: string; customerEmail: string; deliveryAddress: string };
export const loadSavedDetails = () => readJson<SavedDetails | null>(DETAILS_KEY, null);
export const saveDetails = (details: SavedDetails | null) => writeJson(DETAILS_KEY, details);

// Orders placed on this phone, with the private code that opens each one.
export type SavedOrder = { id: number; token: string | null; placedAt: string };
export const loadSavedOrders = () => readJson<SavedOrder[]>(ORDERS_KEY, []);
export const savedOrderToken = (id: number) => loadSavedOrders().find((order) => order.id === id)?.token ?? null;

export function rememberOrder(order: { id: number; accessToken?: string | null; createdAt?: string }) {
  const others = loadSavedOrders().filter((saved) => saved.id !== order.id);
  const previous = loadSavedOrders().find((saved) => saved.id === order.id);
  writeJson(ORDERS_KEY, [
    { id: order.id, token: order.accessToken ?? previous?.token ?? null, placedAt: order.createdAt ?? previous?.placedAt ?? new Date().toISOString() },
    ...others,
  ].slice(0, 30));
}

// The private link to an order, for sharing with the customer or opening again later.
export function orderPath(order: { id: number; accessToken?: string | null }) {
  return `/order/${order.id}${order.accessToken ? `?t=${encodeURIComponent(order.accessToken)}` : ""}`;
}

// The shop's public address for links sent to customers: the live domain the server puts in the
// page's canonical link, so links are right even when the page was opened on another address.
export function publicSiteOrigin() {
  try {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    if (canonical) return new URL(canonical).origin;
  } catch {
    // Fall back to the address this page is on.
  }
  return window.location.origin;
}

export const customerOrderLink = (order: { id: number; accessToken?: string | null }) => `${publicSiteOrigin()}${orderPath(order)}`;

// A friend's referral code from a shared link (?ref=CODE), kept until checkout.
export function captureReferralCodeFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
    if (code && /^[A-Z0-9]{4,20}$/.test(code)) writeJson(REFERRAL_KEY, code);
  } catch {
    // Ignore malformed addresses.
  }
}
export const loadReferralCode = () => readJson<string | null>(REFERRAL_KEY, null);
export const clearReferralCode = () => writeJson(REFERRAL_KEY, null);

export type ReferralProgramme = { enabled: boolean; friendDiscount: number; referrerReward: number };

export function referralLink(code: string) {
  return `${publicSiteOrigin()}/?ref=${encodeURIComponent(code)}`;
}

export function referralShareText(code: string, programme: { friendDiscount: number }) {
  return `I get my cakes from Channah Cake House in Mombasa. Use my code ${code} for KES ${programme.friendDiscount.toLocaleString()} off your first order: ${referralLink(code)}`;
}

export async function checkReferralCode(code: string): Promise<{ valid: boolean; discount?: number }> {
  const response = await fetch(`${getApiBaseUrl()}/api/referrals/check?code=${encodeURIComponent(code)}`);
  return response.ok ? response.json() : { valid: false };
}

// ——— Optional sign-in (a code sent by email) ———

export type CustomerSession = { token: string; email: string };
const sessionListeners = new Set<() => void>();
let cachedSession: CustomerSession | null | undefined;

function readSession() {
  if (cachedSession === undefined) cachedSession = readJson<CustomerSession | null>(SESSION_KEY, null);
  return cachedSession;
}

export function setCustomerSession(session: CustomerSession | null) {
  cachedSession = session;
  writeJson(SESSION_KEY, session);
  sessionListeners.forEach((listener) => listener());
}

export function useCustomerSession() {
  return useSyncExternalStore(
    (listener) => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
    readSession,
    () => null,
  );
}

export function customerHeaders(session: CustomerSession | null = readSession()): Record<string, string> {
  return session ? { "X-Customer-Token": session.token } : {};
}

// "Sign in" only shows once the shop can send the emailed codes.
export function useEmailLoginAvailable() {
  const { data } = useQuery({
    queryKey: ["customer-auth-config"],
    queryFn: async () => {
      const response = await fetch(`${getApiBaseUrl()}/api/customer/auth/config`);
      return response.ok ? ((await response.json()) as { emailLogin: boolean }) : { emailLogin: false };
    },
    staleTime: 10 * 60_000,
  });
  return data?.emailLogin === true;
}

export type AccountDetails = { email: string; name: string; phone: string; address: string };
export type AccountOrder = {
  id: number;
  createdAt: string;
  total: number;
  status: string;
  paymentStatus: string;
  accessToken: string | null;
  items: { cakeName: string; quantity: number; variantLabel: string | null }[];
};
export type AccountReferral = { code: string; creditBalance: number; friendDiscount: number; referrerReward: number; phone?: string };
export type AccountOverview = { account: AccountDetails; orders: AccountOrder[]; referral: AccountReferral | null };

const api = (path: string) => `${getApiBaseUrl()}/api${path}`;

export function startEmailSignIn(email: string) {
  return customFetch<{ sent: boolean }>(api("/customer/auth/start"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function verifyEmailSignIn(email: string, code: string) {
  return customFetch<{ token: string; account: AccountDetails }>(api("/customer/auth/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}

export function fetchAccountOverview(session: CustomerSession) {
  return customFetch<AccountOverview>(api("/customer/me"), { headers: customerHeaders(session) });
}

export function saveAccountDetails(session: CustomerSession, details: Omit<AccountDetails, "email">) {
  return customFetch<{ account: AccountDetails }>(api("/customer/me"), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...customerHeaders(session) },
    body: JSON.stringify(details),
  });
}

// The signed-in customer's account, orders and referral code; signs out when the session has expired.
export function useAccountOverview() {
  const session = useCustomerSession();
  return useQuery({
    queryKey: ["customer-account", session?.token],
    enabled: !!session,
    queryFn: async () => {
      try {
        return await fetchAccountOverview(session!);
      } catch (error) {
        if ((error as { status?: number }).status === 401) setCustomerSession(null);
        throw error;
      }
    },
  });
}

// A readable message from a failed request (the server's own words when it gave some).
export function errorMessage(error: unknown, fallback = "Please try again.") {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  if (typeof data?.error === "string") return data.error;
  return fallback;
}
