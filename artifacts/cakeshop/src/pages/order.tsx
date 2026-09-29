import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getOrder, initiateMpesaPayment, useListCakes, type Order } from "@workspace/api-client-react";
import { CheckCircle2, Clock3, Copy, Gift, Loader2, MapPin, Package, Phone, RotateCcw, Share2, Star, XCircle } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import { useAuth } from "@/lib/auth-context";
import { cakeSizes, useCakeOptions } from "@/lib/cake-options";
import { useCart } from "@/lib/cart-context";
import {
  customerHeaders,
  errorMessage,
  orderPath,
  referralLink,
  referralShareText,
  rememberOrder,
  savedOrderToken,
  useCustomerSession,
} from "@/lib/customer";
import { orderItemChoices } from "@/lib/order-items";
import { DEFAULT_PAYMENT_DETAILS, fetchPaymentDetails } from "@/lib/payment-details";
import { displayKenyanPhone, isValidKenyanMobile, normalizeKenyanPhone } from "@/lib/phone";
import { WHATSAPP_URL } from "@/lib/store-info";
import { cn } from "@/lib/utils";

type OrderReferral = NonNullable<Order["referral"]>;

const kes = (value: number) => `KES ${Math.round(value).toLocaleString()}`;

// The customer's order: progress, paying (again), reviewing their cakes, sharing their referral code and
// ordering the same again. Opened with its private link, the phone number it was placed with, or their sign-in.
export default function OrderPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const session = useCustomerSession();
  const { token: adminToken } = useAuth();
  const [token, setToken] = useState<string | null>(() => new URLSearchParams(search).get("t") ?? savedOrderToken(orderId));
  const [phone, setPhone] = useState<string | null>(null);
  const [fastUntil, setFastUntil] = useState(0);

  const headers: Record<string, string> = {
    ...(token ? { "X-Order-Token": token } : {}),
    ...(phone ? { "X-Order-Phone": phone } : {}),
    ...customerHeaders(session),
  };
  const { data: order, error, isLoading, refetch } = useQuery({
    queryKey: ["order", orderId, token, phone, session?.token ?? null],
    queryFn: () => getOrder(orderId, { headers }),
    enabled: Number.isInteger(orderId) && orderId > 0,
    retry: false,
    // Keeps up with the payment and the bakery's progress: every few seconds right after an M-Pesa prompt.
    refetchInterval: (query) => {
      const current = query.state.data;
      if (!current || current.status === "cancelled" || current.status === "delivered") return false;
      return Date.now() < fastUntil ? 3000 : 20_000;
    },
  });

  // Remember it on this phone, and keep the private link in the address bar for bookmarking or sharing.
  // Staff looking at a customer's order don't get it added to their own "My orders".
  useEffect(() => {
    if (!order) return;
    if (!adminToken) rememberOrder(order);
    if (order.accessToken && order.accessToken !== token) setToken(order.accessToken);
    if (order.accessToken) window.history.replaceState(window.history.state, "", orderPath(order));
  }, [order, token, adminToken]);

  const status = (error as { status?: number } | null)?.status;
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }
  if (status === 401) return <PhoneGate orderId={orderId} tried={phone} onPhone={setPhone} />;
  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">{status === 404 ? "Order not found" : "We couldn't load this order"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {status === 404 ? "Check the order number, or find it under My orders." : "Check your connection and try again."}
        </p>
        <div className="flex justify-center gap-2">
          {status !== 404 && (
            <Button variant="outline" className="rounded-full" onClick={() => refetch()}>
              Try again
            </Button>
          )}
          <Button asChild className="rounded-full px-6">
            <Link href="/orders">My orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const paid = order.paymentStatus === "paid";
  const cancelled = order.status === "cancelled";
  // Reviews once the cake has arrived: marked delivered, or its delivery day has come.
  const received = order.status === "delivered" || (!!order.deliveryDate && new Date(`${order.deliveryDate}T00:00:00`) <= new Date());
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-12 pt-6">
      <OrderHeader order={order} />
      {!cancelled && <OrderProgress order={order} />}
      {!paid && !cancelled && <PayCard order={order} headers={headers} onPromptSent={() => setFastUntil(Date.now() + 3 * 60_000)} />}
      {paid && !cancelled && received && <ReviewSection order={order} />}
      <OrderItems order={order} />
      <DeliveryCard order={order} />
      {order.referral && paid && !cancelled && <ReferralCard referral={order.referral} phone={order.customerPhone} />}
      <OrderActions order={order} onOrderAgain={() => setLocation("/cart")} />
    </div>
  );
}

// Older links have no private code: the phone number the order was placed with opens it.
function PhoneGate({ orderId, tried, onPhone }: { orderId: number; tried: string | null; onPhone: (phone: string) => void }) {
  // Keeps the number that didn't match in the box, to correct rather than retype.
  const [value, setValue] = useState(() => (tried ? displayKenyanPhone(tried) : ""));
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight">Order #{orderId}</h1>
      <p className="mt-2 text-sm text-muted-foreground">To keep orders private, enter the phone number you used for this order.</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const normalized = normalizeKenyanPhone(value);
          if (!isValidKenyanMobile(normalized)) {
            setProblem("Enter your phone number, e.g. 0712 345 678");
            return;
          }
          setProblem(null);
          onPhone(normalized);
        }}
      >
        <Label htmlFor="order-phone">Phone number</Label>
        <Input id="order-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={value} onChange={(e) => setValue(e.target.value)} />
        {(problem || tried) && <p className="text-sm text-destructive">{problem ?? "That number doesn't match this order."}</p>}
        <Button type="submit" className="w-full rounded-full">
          Show my order
        </Button>
      </form>
    </div>
  );
}

function OrderHeader({ order }: { order: Order }) {
  const paid = order.paymentStatus === "paid";
  const cancelled = order.status === "cancelled";
  const [title, text] = cancelled
    ? ["Order cancelled", "This order was cancelled. Message us on WhatsApp if that's unexpected."]
    : order.status === "delivered"
      ? ["Delivered. Enjoy!", "Thank you for ordering from Channah Cake House."]
      : order.status === "ready"
        ? ["Your order is ready!", "We'll be in touch about delivery."]
        : order.status === "preparing"
          ? ["Your cake is being made", "We'll let you know when it's ready."]
          : paid
            ? ["Thank you!", "We've received your payment and we'll get baking."]
            : order.paymentStatus === "failed"
              ? ["Payment didn't go through", "Your order is saved. Pay below to confirm it."]
              : ["Order received", "Pay with M-Pesa below to confirm your order."];
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center">
      <div
        className={cn(
          "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
          cancelled ? "bg-muted" : paid ? "bg-primary/10" : "bg-amber-100",
        )}
      >
        {cancelled ? <XCircle className="h-8 w-8 text-muted-foreground" /> : paid ? <CheckCircle2 className="h-8 w-8 text-primary" /> : <Clock3 className="h-8 w-8 text-amber-700" />}
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 px-3 py-3 text-left text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Order</dt>
          <dd className="font-bold">#{order.id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Placed</dt>
          <dd className="font-bold">{format(new Date(order.createdAt), "d MMM yyyy")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="font-bold">{kes(order.total)}</dd>
        </div>
      </dl>
    </section>
  );
}

const STEPS = [
  { label: "Placed", done: () => true },
  { label: "Paid", done: (order: Order) => order.paymentStatus === "paid" },
  { label: "Being made", done: (order: Order) => ["preparing", "ready", "delivered"].includes(order.status) },
  { label: "Ready", done: (order: Order) => ["ready", "delivered"].includes(order.status) },
  { label: "Delivered", done: (order: Order) => order.status === "delivered" },
];

function OrderProgress({ order }: { order: Order }) {
  return (
    <section aria-label="Order progress" className="rounded-2xl border border-border bg-card px-4 py-5">
      <ol className="grid grid-cols-5 gap-1">
        {STEPS.map((step, index) => {
          const done = step.done(order);
          return (
            <li key={step.label} className="flex flex-col items-center gap-1.5 text-center">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                  done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? "✓" : index + 1}
              </span>
              <span className={cn("text-[11px] font-semibold leading-tight", done ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
                <span className="sr-only">{done ? " (done)" : " (to come)"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PayCard({ order, headers, onPromptSent }: { order: Order; headers: Record<string, string>; onPromptSent: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const { data: paymentDetails } = useQuery({ queryKey: ["payment-details"], queryFn: fetchPaymentDetails, placeholderData: DEFAULT_PAYMENT_DETAILS });
  const isBuyGoods = paymentDetails?.transactionType === "CustomerBuyGoodsOnline";
  const payNumber = isBuyGoods
    ? paymentDetails?.tillNumber || DEFAULT_PAYMENT_DETAILS.tillNumber
    : paymentDetails?.businessShortCode || DEFAULT_PAYMENT_DETAILS.businessShortCode;
  const payReference = `${paymentDetails?.accountReferencePrefix || DEFAULT_PAYMENT_DETAILS.accountReferencePrefix}-${order.id}`;

  const sendPrompt = async () => {
    setState("sending");
    setProblem(null);
    try {
      await initiateMpesaPayment({ orderId: order.id, phone: order.customerPhone, amount: order.total }, { headers });
      setState("sent");
      onPromptSent();
    } catch (error) {
      setState("error");
      setProblem(errorMessage(error, "We couldn't send the M-Pesa prompt. Please pay with the details below."));
    }
  };

  return (
    <section aria-labelledby="pay-title" className="rounded-2xl border border-[#52B44B]/30 bg-[#52B44B]/5 p-5">
      <h2 id="pay-title" className="text-base font-bold">
        Pay {kes(order.total)} with M-Pesa
      </h2>
      {state === "sent" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Check your phone ({displayKenyanPhone(order.customerPhone)}) and enter your M-Pesa PIN. This page updates when the payment arrives.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">We'll send a payment prompt to {displayKenyanPhone(order.customerPhone)}.</p>
      )}
      <Button
        className="mt-4 h-11 w-full rounded-full bg-[#52B44B] font-bold text-white hover:bg-[#52B44B]/90"
        onClick={sendPrompt}
        disabled={state === "sending"}
      >
        {state === "sending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {state === "sent" ? "Send the prompt again" : "Send M-Pesa prompt"}
      </Button>
      {problem && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {problem}
        </p>
      )}
      <div className="mt-4 space-y-1.5 rounded-xl border border-dashed border-[#52B44B]/40 bg-card p-4 text-sm">
        <p className="font-medium">Or pay yourself:</p>
        <p className="text-muted-foreground">
          {isBuyGoods ? "Lipa na M-Pesa → Buy Goods, till" : "Lipa na M-Pesa → Pay Bill, business number"}{" "}
          <strong className="text-foreground">{payNumber}</strong>
          {!isBuyGoods && (
            <>
              , account <strong className="text-foreground">{payReference}</strong>
            </>
          )}
          , amount <strong className="text-foreground">{kes(order.total)}</strong>.
        </p>
      </div>
    </section>
  );
}

function OrderItems({ order }: { order: Order }) {
  const subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  const credit = order.creditUsed ?? 0;
  return (
    <section aria-labelledby="items-title" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="items-title" className="mb-4 flex items-center gap-2 text-base font-bold">
        <Package className="h-5 w-5 text-muted-foreground" /> Your cakes
      </h2>
      <div className="space-y-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-4 text-sm last:border-0 last:pb-0">
            <div className="flex items-start gap-3">
              <span className="rounded bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">{item.quantity}×</span>
              <div>
                <p className="font-medium">
                  {item.cakeName}
                  {item.variantLabel ? ` (${item.variantLabel})` : ""}
                </p>
                {orderItemChoices(item).map((choice) => (
                  <p key={choice} className="text-xs text-muted-foreground">
                    {choice}
                  </p>
                ))}
              </div>
            </div>
            <span className="shrink-0 font-medium text-muted-foreground">{kes(item.subtotal)}</span>
          </div>
        ))}
      </div>
      <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        {(order.discountAmount > 0 || credit > 0) && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal</dt>
            <dd>{kes(subtotal)}</dd>
          </div>
        )}
        {order.discountAmount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Discount{order.promoCode ? ` (${order.promoCode})` : ""}</dt>
            <dd>- {kes(order.discountAmount)}</dd>
          </div>
        )}
        {credit > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Referral reward</dt>
            <dd>- {kes(credit)}</dd>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <dt>Total</dt>
          <dd>{kes(order.total)}</dd>
        </div>
        {order.mpesaReceiptNo && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>M-Pesa receipt</dt>
            <dd>{order.mpesaReceiptNo}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function DeliveryCard({ order }: { order: Order }) {
  return (
    <section aria-labelledby="delivery-title" className="rounded-2xl border border-border bg-card p-5 text-sm">
      <h2 id="delivery-title" className="mb-3 flex items-center gap-2 text-base font-bold">
        <MapPin className="h-5 w-5 text-muted-foreground" /> Delivery
      </h2>
      {order.deliveryDate && <p className="font-medium">{format(new Date(`${order.deliveryDate}T00:00:00`), "EEEE d MMMM yyyy")}</p>}
      <p className="text-muted-foreground">{order.deliveryAddress}</p>
      <p className="mt-2 flex items-center text-muted-foreground">
        <Phone className="mr-2 h-4 w-4" /> {order.customerName} · {displayKenyanPhone(order.customerPhone)}
      </p>
      {order.notes && <p className="mt-2 whitespace-pre-line text-muted-foreground">Note: {order.notes}</p>}
    </section>
  );
}

const reviewedKey = (orderId: number) => `channah-reviewed-${orderId}`;
function loadReviewed(orderId: number): number[] {
  try {
    return JSON.parse(window.localStorage.getItem(reviewedKey(orderId)) ?? "[]");
  } catch {
    return [];
  }
}

// Once paid, customers can rate each cake in their order right here.
function ReviewSection({ order }: { order: Order }) {
  const cakes = useMemo(
    () => order.items.filter((item, index, all) => all.findIndex((other) => other.cakeId === item.cakeId) === index),
    [order.items],
  );
  return (
    <section aria-labelledby="review-title" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="review-title" className="flex items-center gap-2 text-base font-bold">
        <Star className="h-5 w-5 text-primary" /> How was your cake?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Your review helps other customers choose.</p>
      <div className="mt-4 space-y-5">
        {cakes.map((item) => (
          <ReviewForm key={item.cakeId} order={order} cakeId={item.cakeId} cakeName={item.cakeName} />
        ))}
      </div>
    </section>
  );
}

function ReviewForm({ order, cakeId, cakeName }: { order: Order; cakeId: number; cakeName: string }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [name, setName] = useState(order.customerName.trim().split(/\s+/)[0] ?? "");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(() => (loadReviewed(order.id).includes(cakeId) ? "done" : "idle"));
  const [problem, setProblem] = useState<string | null>(null);

  const markReviewed = () => {
    try {
      window.localStorage.setItem(reviewedKey(order.id), JSON.stringify([...new Set([...loadReviewed(order.id), cakeId])]));
    } catch {
      // Not remembered; the server still refuses a second review for this order.
    }
    setState("done");
  };

  if (state === "done") {
    return <p className="rounded-xl bg-primary/5 p-3 text-sm font-medium text-primary">Thank you for reviewing {cakeName}!</p>;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (body.trim().length < 5) {
      setProblem("Please write a few words.");
      return;
    }
    setState("sending");
    setProblem(null);
    const response = await fetch(`${getApiBaseUrl()}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cakeId, orderId: order.id, customerPhone: order.customerPhone, authorName: name.trim() || "Customer", rating, body: body.trim() }),
    }).catch(() => null);
    if (response?.ok || response?.status === 409) {
      markReviewed();
      return;
    }
    const data = await response?.json().catch(() => null);
    setState("error");
    setProblem(typeof data?.error === "string" ? data.error : "We couldn't save your review. Please try again.");
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-muted/40 p-4" aria-label={`Review ${cakeName}`}>
      <p className="text-sm font-semibold">{cakeName}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            onClick={() => setRating(value)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <Star className={cn("h-6 w-6", value <= rating ? "fill-primary text-primary" : "text-border")} />
          </button>
        ))}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you and your guests think?" maxLength={2000} className="bg-background" aria-label="Your review" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Your name" className="bg-background sm:w-48" aria-label="Your name" />
        <Button type="submit" className="rounded-full" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Post review"}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </form>
  );
}

// "Give KES 200, get KES 200": the customer's code, ready to share.
export function ReferralCard({ referral, phone }: { referral: OrderReferral; phone?: string }) {
  const { toast } = useToast();
  const link = referralLink(referral.code);
  const text = referralShareText(referral.code, referral);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Paste it to a friend on WhatsApp, Instagram or SMS." });
    } catch {
      toast({ title: "Your link", description: link });
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "Channah Cake House", text });
    } catch {
      // Closing the share sheet rejects; nothing to do.
    }
  };
  return (
    <section aria-labelledby="referral-title" className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <h2 id="referral-title" className="flex items-center gap-2 text-base font-bold">
        <Gift className="h-5 w-5 text-primary" /> Give {kes(referral.friendDiscount)}, get {kes(referral.referrerReward)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Share your code. Friends get {kes(referral.friendDiscount)} off their first order, and you get {kes(referral.referrerReward)} off your next
        order once they've paid.
      </p>
      <p className="mt-3 text-center text-2xl font-extrabold tracking-widest" aria-label={`Your code: ${referral.code}`}>
        {referral.code}
      </p>
      {referral.creditBalance > 0 && (
        <p className="mt-2 rounded-lg bg-card p-3 text-center text-sm font-medium text-emerald-700">
          You have {kes(referral.creditBalance)} to spend. It comes off your next order automatically
          {phone ? ` when you order with ${displayKenyanPhone(phone)}.` : "."}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild className="rounded-full bg-[#25D366] text-white hover:bg-[#1fb958]">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <SiWhatsapp className="mr-2 h-4 w-4" /> WhatsApp
          </a>
        </Button>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <Button variant="outline" className="rounded-full" onClick={share}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        ) : (
          <Button variant="outline" className="rounded-full" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </Button>
        )}
      </div>
    </section>
  );
}

function OrderActions({ order, onOrderAgain }: { order: Order; onOrderAgain: () => void }) {
  const { data: cakes } = useListCakes();
  const cakeOptions = useCakeOptions();
  const { addItem } = useCart();
  const { toast } = useToast();

  // Puts the same cakes, sizes, flavours and messages back in the cart (skipping any no longer sold).
  const orderAgain = () => {
    const skipped: string[] = [];
    let added = 0;
    for (const item of order.items) {
      const cake = cakes?.find((candidate) => candidate.id === item.cakeId && candidate.available);
      const size = cake && item.variantLabel ? cakeSizes(cake, cakeOptions).find((option) => option.label === item.variantLabel) : null;
      if (!cake || (item.variantLabel && !size)) {
        skipped.push(item.cakeName);
        continue;
      }
      addItem(cake, item.quantity, {
        variantLabel: size?.label ?? null,
        variantPrice: size?.price ?? null,
        flavour: item.flavour ?? null,
        secondFlavour: item.secondFlavour ?? null,
        message: item.cakeMessage ?? "",
      });
      added++;
    }
    if (skipped.length) toast({ title: "Some cakes aren't available now", description: skipped.join(", ") });
    if (added) onOrderAgain();
  };

  return (
    <section className="grid gap-2 sm:grid-cols-3">
      <Button className="rounded-full" onClick={orderAgain} disabled={!cakes || !cakeOptions}>
        <RotateCcw className="mr-2 h-4 w-4" /> Order again
      </Button>
      <Button asChild variant="outline" className="rounded-full">
        <a href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hi! About my order #${order.id}`)}`} target="_blank" rel="noopener noreferrer">
          <SiWhatsapp className="mr-2 h-4 w-4 text-[#25D366]" /> Ask about it
        </a>
      </Button>
      <Button asChild variant="ghost" className="rounded-full">
        <Link href="/">Continue shopping</Link>
      </Button>
    </section>
  );
}
