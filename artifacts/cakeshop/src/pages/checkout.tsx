import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cartLineKey, useCart } from "@/lib/cart-context";
import {
  createOrder,
  getGetOrderQueryKey,
  initiateMpesaPayment,
  useGetOrder,
  useListPromotions,
  type Order,
  type Promotion,
} from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  checkReferralCode,
  clearReferralCode,
  customerHeaders,
  errorMessage,
  loadReferralCode,
  loadSavedDetails,
  orderPath,
  rememberOrder,
  saveDetails,
  useAccountOverview,
  useCustomerSession,
  useEmailLoginAvailable,
} from "@/lib/customer";
import { CheckCircle2, Loader2 } from "lucide-react";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import { usePaymentDetails } from "@/lib/payment-details";
import { MpesaManualPayment } from "@/components/mpesa-manual-payment";
import { displayKenyanPhone, isValidKenyanMobile, normalizeKenyanPhone, phoneKey } from "@/lib/phone";

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z
    .string()
    .transform(normalizeKenyanPhone)
    .refine(isValidKenyanMobile, "Enter your M-Pesa number, e.g. 0712 345 678"),
  customerEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  deliveryAddress: z.string().min(5, "Delivery address is required"),
  deliveryDate: z.string().min(1, "Please select a delivery date").refine(
    (val) => new Date(val) >= new Date(tomorrow()),
    "Delivery date must be at least tomorrow — we need time to bake!"
  ),
  notes: z.string().optional(),
  promoCode: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type PromotionPreview = {
  promotion: Promotion | null;
  discountAmount: number;
  label: string | null;
  message: string | null;
};

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const [, setLocation] = useLocation();

  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const statusPanelRef = useRef<HTMLDivElement>(null);
  // "manual": paying the till or paybill from the M-Pesa menu and sending the code (when the shop doesn't send prompts).
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "prompted" | "success" | "failed" | "manual">("idle");
  // The order once it's placed: the cart is emptied then, and paying again reuses this order.
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const session = useCustomerSession();
  const { data: account } = useAccountOverview();
  const loginAvailable = useEmailLoginAvailable();
  const { data: promotions } = useListPromotions();
  const { data: paymentDetails } = usePaymentDetails();
  const sendsPrompt = paymentDetails?.stkEnabled === true;

  // Polling logic when payment is prompted
  const { data: orderData } = useGetOrder(activeOrderId as number, {
    query: {
      enabled: !!activeOrderId && paymentStatus === "prompted",
      queryKey: getGetOrderQueryKey(activeOrderId as number),
      refetchInterval: 3000,
    },
    request: { headers: placedOrder?.accessToken ? { "X-Order-Token": placedOrder.accessToken } : {} },
  });

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    // Filled in from last time on this phone, and a friend's referral code from their link.
    defaultValues: (() => {
      const saved = loadSavedDetails();
      return {
        customerName: saved?.customerName ?? "",
        customerPhone: saved?.customerPhone ? displayKenyanPhone(saved.customerPhone) : "",
        customerEmail: saved?.customerEmail ?? "",
        deliveryAddress: saved?.deliveryAddress ?? "",
        deliveryDate: "",
        notes: "",
        promoCode: loadReferralCode() ?? "",
      };
    })(),
  });

  // Signed-in customers get their saved details filled in (anything already typed stays).
  useEffect(() => {
    if (!account) return;
    const fill = { customerName: account.account.name, customerPhone: account.account.phone ? displayKenyanPhone(account.account.phone) : "", customerEmail: account.account.email, deliveryAddress: account.account.address };
    for (const [field, value] of Object.entries(fill) as [keyof typeof fill, string][]) {
      if (value && !form.getValues(field)) form.setValue(field, value);
    }
  }, [account, form]);

  const promoCode = form.watch("promoCode");
  const promotionPreview = resolvePromotionPreview(promotions ?? [], items, total, promoCode);
  // A code that isn't a promotion may be a friend's referral code (a first order gets money off).
  const typedCode = promoCode?.trim() ?? "";
  const isPromotionCode = !!promotionPreview.promotion?.code;
  const { data: referralCheck } = useQuery({
    queryKey: ["referral-check", typedCode.toUpperCase()],
    queryFn: () => checkReferralCode(typedCode),
    enabled: typedCode.length >= 4 && !isPromotionCode,
    staleTime: 60_000,
  });
  const referralDiscount = !isPromotionCode && referralCheck?.valid ? Math.min(referralCheck.discount ?? 0, total) : 0;
  const checkingCode = typedCode.length >= 4 && !isPromotionCode && !referralCheck;
  const preview =
    referralDiscount > 0
      ? { discountAmount: referralDiscount, label: typedCode.toUpperCase(), message: `Friend's referral code: KES ${referralDiscount.toLocaleString()} off your first order.` }
      : checkingCode
        ? { ...promotionPreview, message: null }
        : promotionPreview;
  // A signed-in customer's referral reward comes off orders placed with the number it belongs to.
  const rewardCredit = account?.referral?.creditBalance ?? 0;
  const creditApplies = rewardCredit > 0 && !!account?.referral?.phone && phoneKey(form.watch("customerPhone") ?? "") === phoneKey(account.referral.phone);
  const expectedCredit = creditApplies ? Math.min(rewardCredit, Math.max(total - preview.discountAmount, 0)) : 0;
  const discountedTotal = Math.max(total - preview.discountAmount - expectedCredit, 0);

  // The form is much taller than the status cards that replace it, so bring each new state into view
  // (on mobile the order summary sits above it).
  useEffect(() => {
    if (paymentStatus !== "idle") {
      statusPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [paymentStatus]);

  useEffect(() => {
    if (orderData?.paymentStatus === "paid") {
      setPaymentStatus("success");
      setTimeout(() => {
        setLocation(orderPath({ id: orderData.id, accessToken: placedOrder?.accessToken }));
      }, 1500);
    } else if (orderData?.paymentStatus === "failed") {
      setPaymentStatus("failed");
    }
  }, [orderData, setLocation, placedOrder]);

  if (items.length === 0 && paymentStatus === "idle" && !placedOrder) {
    setLocation("/cart");
    return null;
  }

  // What the summary shows: the cart, or the order once it's placed (the cart is empty by then).
  const summaryLines = placedOrder
    ? placedOrder.items.map((item) => ({
        key: String(item.id),
        name: item.cakeName,
        image: item.cakeImage,
        quantity: item.quantity,
        variantLabel: item.variantLabel,
        flavour: item.flavour,
        secondFlavour: item.secondFlavour,
        message: item.cakeMessage,
        unitPrice: item.unitPrice,
      }))
    : items.map((item) => ({
        key: cartLineKey(item),
        name: item.cake.name,
        image: item.cake.imageUrl,
        quantity: item.quantity,
        variantLabel: item.variantLabel,
        flavour: item.flavour,
        secondFlavour: item.secondFlavour,
        message: item.message,
        unitPrice: item.variantPrice ?? item.cake.price,
      }));
  const summarySubtotal = placedOrder ? placedOrder.items.reduce((sum, item) => sum + item.subtotal, 0) : total;
  const summaryDiscount = placedOrder ? placedOrder.discountAmount : preview.discountAmount;
  const summaryDiscountLabel = placedOrder ? placedOrder.promoCode : preview.label;
  const summaryCredit = placedOrder ? (placedOrder.creditUsed ?? 0) : expectedCredit;
  const summaryTotal = placedOrder ? placedOrder.total : discountedTotal;

  const orderHeaders: Record<string, string> = placedOrder?.accessToken ? { "X-Order-Token": placedOrder.accessToken } : {};
  const manualPayment = placedOrder ? (
    <MpesaManualPayment
      order={placedOrder}
      headers={orderHeaders}
      onSent={(updated) => setPlacedOrder((current) => (current ? { ...current, paymentCheck: updated.paymentCheck } : current))}
    />
  ) : null;

  // Sends the M-Pesa prompt for the placed order (again, when the first prompt didn't go through). Shops that
  // don't send prompts go straight to paying the till and sending the code.
  const startPayment = async (order: Order) => {
    if (!sendsPrompt) {
      setPaymentStatus("manual");
      return;
    }
    setPaymentStatus("processing");
    try {
      await initiateMpesaPayment(
        { orderId: order.id, phone: order.customerPhone, amount: order.total },
        { headers: order.accessToken ? { "X-Order-Token": order.accessToken } : {} },
      );
      setPaymentStatus("prompted");
    } catch (error) {
      console.error(error);
      setPaymentStatus((error as { data?: { manualOnly?: boolean } }).data?.manualOnly ? "manual" : "failed");
    }
  };

  const onSubmit = async (values: CheckoutFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    // Each cake's size, flavours and message are saved with that cake, so admin and the order email show them per cake.
    const orderItems = items.map((item) => ({
      cakeId: item.cake.id,
      quantity: item.quantity,
      variantLabel: item.variantLabel || undefined,
      flavour: item.flavour || undefined,
      secondFlavour: item.secondFlavour || undefined,
      cakeMessage: item.message || undefined,
    }));

    let order: Order;
    try {
      order = await createOrder(
        {
          ...values,
          notes: values.notes?.trim() || undefined,
          deliveryDate: values.deliveryDate || undefined,
          promoCode: values.promoCode?.trim() || undefined,
          items: orderItems,
        },
        { headers: customerHeaders(session) },
      );
    } catch (error) {
      setSubmitting(false);
      setSubmitError(errorMessage(error, "We couldn't place your order. Please check your details and try again."));
      return;
    }

    // The order is in: remember it on this phone, empty the cart, and ask for payment.
    rememberOrder(order);
    saveDetails(
      rememberMe
        ? { customerName: values.customerName, customerPhone: values.customerPhone, customerEmail: values.customerEmail ?? "", deliveryAddress: values.deliveryAddress }
        : null,
    );
    if (values.promoCode?.trim()) clearReferralCode();
    setPlacedOrder(order);
    setActiveOrderId(order.id);
    clearCart();
    setSubmitting(false);
    await startPayment(order);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6">
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div ref={statusPanelRef} className="scroll-mt-20">
          {paymentStatus === "idle" ? (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="mb-5 text-base font-bold">Delivery details</h2>
              {!session && loginAvailable && (
                <p className="mb-5 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                  Ordered before?{" "}
                  <Link href="/account" className="font-semibold text-primary underline-offset-2 hover:underline">
                    Sign in
                  </Link>{" "}
                  to fill this in and track your orders.
                </p>
              )}
              {submitError && (
                <div role="alert" className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 text-sm font-medium border border-destructive/20">
                  {submitError}
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" autoComplete="name" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>M-Pesa Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="0712 345 678"
                            {...field}
                            className="bg-background"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">This number receives the M-Pesa payment prompt.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email for order updates (optional)</FormLabel>
                        <FormControl>
                          <Input type="email" inputMode="email" autoComplete="email" placeholder="jane@example.com" {...field} className="bg-background" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">We'll email your receipt and let you know as your order moves along.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Apartment, Street, Area..." autoComplete="street-address" {...field} className="bg-background resize-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Date</FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            min={tomorrow()}
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">We need at least 24 hours notice to prepare your cake.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Instructions (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="E.g., best delivery time or a nearby landmark" {...field} className="bg-background resize-none" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="promoCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Promo or referral code (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="WEEKEND15" autoCapitalize="characters" autoCorrect="off" spellCheck={false} {...field} className="bg-background" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">A shop offer code, or a friend's code for money off your first order.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Checkbox checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} className="mt-0.5" />
                    <span>Remember my details on this phone for next time</span>
                  </label>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-12 rounded-full bg-[#52B44B] hover:bg-[#52B44B]/90 text-white font-bold text-base"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
                      </>
                    ) : (
                      sendsPrompt ? `Pay KES ${discountedTotal.toLocaleString()} with M-Pesa` : `Place order · KES ${discountedTotal.toLocaleString()}`
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          ) : paymentStatus === "prompted" ? (
            <div className="rounded-2xl border border-[#52B44B]/30 bg-card p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-[#52B44B]/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Loader2 className="h-10 w-10 text-[#52B44B] animate-spin" />
                </div>
                <h2 className="text-xl font-extrabold mb-2 text-[#52B44B]">Check your phone</h2>
                <p className="text-muted-foreground text-base max-w-xs mx-auto">
                  We've sent an M-Pesa prompt to your phone. Enter your PIN to pay{" "}
                  <strong>KES {(placedOrder?.total ?? discountedTotal).toLocaleString()}</strong>.
                </p>
              </div>
              <p className="mb-3 text-center text-sm font-medium text-muted-foreground">No prompt? Pay from the M-Pesa menu instead:</p>
              {manualPayment}
            </div>
          ) : paymentStatus === "processing" ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-extrabold mb-2">Placing your order…</h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                {sendsPrompt ? "Please wait while we send the M-Pesa prompt to your phone." : "Just a moment while we save your order."}
              </p>
            </div>
          ) : paymentStatus === "manual" && placedOrder ? (
            <div className="rounded-2xl border border-[#52B44B]/30 bg-card p-5 sm:p-6">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#52B44B]/10">
                  <CheckCircle2 className="h-7 w-7 text-[#52B44B]" />
                </div>
                <h2 className="text-xl font-extrabold">We've received your order #{placedOrder.id}</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Now pay <strong className="text-foreground">KES {Math.ceil(placedOrder.total).toLocaleString()}</strong> with M-Pesa, then send us the
                  M-Pesa code so we can confirm it.
                </p>
                {placedOrder.customerEmail && loginAvailable && (
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">A copy of your order is on its way to {placedOrder.customerEmail}.</p>
                )}
              </div>
              {manualPayment}
              <Button variant="outline" className="mt-4 w-full rounded-full" onClick={() => setLocation(orderPath(placedOrder))}>
                View my order
              </Button>
            </div>
          ) : paymentStatus === "failed" && activeOrderId ? (
            <div className="rounded-2xl border border-amber-400/40 bg-card p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                    <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-extrabold mb-2 text-amber-600 dark:text-amber-400">The M-Pesa prompt didn't go through</h2>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  Your order <strong>#{activeOrderId}</strong> is saved. Pay from the M-Pesa menu below and send us the code, or try the prompt again.
                </p>
              </div>
              {manualPayment}
              <div className="mt-6 flex flex-col gap-3">
                {sendsPrompt && (
                  <Button
                    className="w-full rounded-full bg-[#52B44B] hover:bg-[#52B44B]/90 text-white font-bold"
                    onClick={() => placedOrder && startPayment(placedOrder)}
                  >
                    Send the M-Pesa prompt again
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => setLocation(orderPath({ id: activeOrderId, accessToken: placedOrder?.accessToken }))}
                >
                  View my order
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#52B44B]/30 bg-card p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-[#52B44B] rounded-full flex items-center justify-center mb-6">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold mb-4 text-[#52B44B]">Payment Successful</h2>
              <p className="text-muted-foreground text-lg">Redirecting to your receipt...</p>
            </div>
          )}
        </div>

        {/* Summary first on mobile, so customers see what they're paying for before the form */}
        <div className="order-first lg:order-last">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-20">
            <h2 className="mb-4 text-base font-bold">Order summary</h2>
            <div className="space-y-4 mb-6">
              {summaryLines.map((item) => {
                const price = item.unitPrice;
                const key = item.key;
                return (
                <div key={key} className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16">
                      <RevealImage
                        src={item.image || DEFAULT_CAKE_IMAGE_URL}
                        alt={item.name}
                        className="object-cover rounded-lg bg-muted"
                        fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                        timeoutMs={2500}
                      />
                    </div>
                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                    {item.variantLabel && (
                      <p className="text-primary text-xs font-medium">{item.variantLabel}</p>
                    )}
                    {item.flavour && <p className="text-muted-foreground text-xs">Flavour: {item.flavour}</p>}
                    {item.secondFlavour && <p className="text-muted-foreground text-xs">Second flavour: {item.secondFlavour}</p>}
                    {item.message && <p className="text-muted-foreground text-xs line-clamp-2">Message: “{item.message}”</p>}
                    <p className="text-muted-foreground text-xs">KES {price.toLocaleString()}</p>
                  </div>
                  <div className="font-medium text-sm">KES {(price * item.quantity).toLocaleString()}</div>
                </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>KES {summarySubtotal.toLocaleString()}</span>
              </div>
              {summaryDiscount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount{summaryDiscountLabel ? ` (${summaryDiscountLabel})` : ""}</span>
                  <span>- KES {summaryDiscount.toLocaleString()}</span>
                </div>
              )}
              {summaryCredit > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Your referral reward</span>
                  <span>- KES {summaryCredit.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-foreground pt-2">
                <span>Total</span>
                <span>KES {summaryTotal.toLocaleString()}</span>
              </div>
              {!placedOrder && preview.message && <p className="pt-2 text-xs leading-5 text-muted-foreground">{preview.message}</p>}
              {!placedOrder && rewardCredit > 0 && !creditApplies && (
                <p className="pt-2 text-xs leading-5 text-emerald-700">
                  Your KES {rewardCredit.toLocaleString()} referral reward comes off automatically when you order with the phone number you used before.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolvePromotionPreview(
  promotions: Promotion[],
  items: { cake: { slug: string; name: string; price: number }; quantity: number; variantPrice?: number | null }[],
  subtotal: number,
  promoCode?: string,
): PromotionPreview {
  const now = Date.now();
  const normalizedCode = promoCode?.trim().toLowerCase() || "";
  const availablePromotions = promotions.filter((promo) => {
    if (!promo.active) return false;
    if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return false;
    if (promo.endsAt && new Date(promo.endsAt).getTime() < now) return false;
    return true;
  });

  const eligiblePromotions = availablePromotions.filter((promo) => isPromotionEligible(promo, items, subtotal));
  const codePromotion = normalizedCode
    ? eligiblePromotions.find((promo) => promo.code?.toLowerCase() === normalizedCode) ?? null
    : null;
  if (normalizedCode && !codePromotion) {
    return {
      promotion: null,
      discountAmount: 0,
      label: null,
      message: "That promo code is not valid for this order.",
    };
  }
  const automaticPromotion = !codePromotion
    ? eligiblePromotions
        .filter((promo) => !promo.code)
        .sort((a, b) => calculatePromotionDiscount(b, items, subtotal) - calculatePromotionDiscount(a, items, subtotal))[0] ?? null
    : null;

  const promotion = codePromotion ?? automaticPromotion;
  if (!promotion) {
    return { promotion: null, discountAmount: 0, label: null, message: null };
  }

  const discountAmount = calculatePromotionDiscount(promotion, items, subtotal);
  return {
    promotion,
    discountAmount,
    label: promotion.code || promotion.title,
    message: describePromotion(promotion, items),
  };
}

function isPromotionEligible(
  promo: Promotion,
  items: { cake: { slug: string }; quantity: number }[],
  subtotal: number,
) {
  if (promo.minimumOrderAmount != null && subtotal < promo.minimumOrderAmount) {
    return false;
  }

  if (promo.applicableCakeSlugs && promo.applicableCakeSlugs.length > 0) {
    return items.some((item) => promo.applicableCakeSlugs?.includes(item.cake.slug));
  }

  return true;
}

function calculatePromotionDiscount(
  promo: Promotion,
  items: { cake: { slug: string }; quantity: number }[],
  subtotal: number,
) {
  if (!isPromotionEligible(promo, items, subtotal)) {
    return 0;
  }

  const discount = promo.discountAmount ?? (promo.discountPct != null ? (subtotal * promo.discountPct) / 100 : 0);
  return Math.min(discount, subtotal);
}

function describePromotion(
  promo: Promotion,
  items: { cake: { slug: string; name: string }; quantity: number }[],
) {
  const cakeNameBySlug = new Map(items.map((item) => [item.cake.slug, item.cake.name]));
  const discountText =
    promo.discountAmount != null
      ? `KES ${promo.discountAmount.toLocaleString()}`
      : promo.discountPct != null
        ? `${promo.discountPct}%`
        : "a special offer";

  const scopeText = (() => {
    if (promo.applicableCakeSlugs && promo.applicableCakeSlugs.length > 0) {
      return promo.applicableCakeSlugs.map((slug) => cakeNameBySlug.get(slug) || humanizeSlug(slug)).join(", ");
    }

    if (promo.minimumOrderAmount != null) {
      return `orders of KES ${promo.minimumOrderAmount.toLocaleString()} or more`;
    }

    return "your order";
  })();

  if (promo.code) {
    return `Use code ${promo.code} to get ${discountText} off ${scopeText}.`;
  }

  if (promo.description) {
    return promo.description;
  }

  return `Get ${discountText} off ${scopeText}.`;
}

function humanizeSlug(value: string) {
  return value.replace(/-/g, " ");
}
