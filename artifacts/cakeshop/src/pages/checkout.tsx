import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCart } from "@/lib/cart-context";
import {
  getGetOrderQueryKey,
  useCreateOrder,
  useGetOrder,
  useInitiateMpesaPayment,
  useListPromotions,
  type Promotion,
} from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().regex(/^254\d{9}$/, "Must be a valid Safaricom number (254XXXXXXXXX)"),
  customerEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  deliveryAddress: z.string().min(5, "Delivery address is required"),
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
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "prompted" | "success" | "failed">("idle");

  const createOrder = useCreateOrder();
  const initiatePayment = useInitiateMpesaPayment();
  const { data: promotions } = useListPromotions();

  // Polling logic when payment is prompted
  const { data: orderData } = useGetOrder(activeOrderId as number, {
    query: {
      enabled: !!activeOrderId && paymentStatus === "prompted",
      queryKey: getGetOrderQueryKey(activeOrderId as number),
      refetchInterval: 3000,
    },
  });

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "254",
      customerEmail: "",
      deliveryAddress: "",
      notes: "",
      promoCode: "",
    },
  });

  const promoCode = form.watch("promoCode");
  const promotionPreview = resolvePromotionPreview(promotions ?? [], items, total, promoCode);
  const discountedTotal = Math.max(total - promotionPreview.discountAmount, 0);

  useEffect(() => {
    if (orderData?.paymentStatus === "paid") {
      setPaymentStatus("success");
      clearCart();
      setTimeout(() => {
        setLocation(`/order/${orderData.id}`);
      }, 1500);
    } else if (orderData?.paymentStatus === "failed") {
      setPaymentStatus("failed");
    }
  }, [orderData, setLocation, clearCart]);

  if (items.length === 0 && paymentStatus === "idle") {
    setLocation("/cart");
    return null;
  }

  const onSubmit = async (values: CheckoutFormValues) => {
    try {
      setPaymentStatus("processing");

      const orderItems = items.map((item) => ({
        cakeId: item.cake.id,
        quantity: item.quantity,
      }));

      const order = await createOrder.mutateAsync({
        data: {
          ...values,
          promoCode: values.promoCode?.trim() || undefined,
          items: orderItems,
        },
      });

      setActiveOrderId(order.id);

      await initiatePayment.mutateAsync({
        data: {
          orderId: order.id,
          phone: values.customerPhone,
          amount: order.total,
        },
      });

      setPaymentStatus("prompted");
    } catch (error) {
      console.error(error);
      setPaymentStatus("failed");
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <h1 className="font-serif text-4xl font-bold mb-8">Checkout</h1>

      <div className="grid lg:grid-cols-2 gap-12">
        <div>
          {paymentStatus === "idle" || paymentStatus === "failed" ? (
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
              <h2 className="font-bold text-xl mb-6">Delivery Details</h2>
              {paymentStatus === "failed" && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 text-sm font-medium border border-destructive/20">
                  Payment failed or was cancelled. Please try again.
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
                          <Input placeholder="Jane Doe" {...field} className="bg-background" />
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
                        <FormLabel>MPesa Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="254700000000" {...field} className="bg-background" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Format: 254XXXXXXXXX</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="jane@example.com" {...field} className="bg-background" />
                        </FormControl>
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
                          <Textarea placeholder="Apartment, Street, Area..." {...field} className="bg-background resize-none" />
                        </FormControl>
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
                          <Textarea placeholder="E.g., Happy Birthday written on the cake" {...field} className="bg-background resize-none" />
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
                        <FormLabel>Promo Code (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="WEEKEND15" {...field} className="bg-background" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Enter a checkout code if you have one. Automatic offers may still apply when your cart qualifies.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 rounded-full bg-[#52B44B] hover:bg-[#52B44B]/90 text-white font-bold text-base"
                    disabled={createOrder.isPending || initiatePayment.isPending}
                  >
                    {createOrder.isPending || initiatePayment.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
                      </>
                    ) : (
                      `Pay KES ${discountedTotal.toLocaleString()} with MPesa`
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          ) : (
            <div className="bg-card border border-[#52B44B]/30 p-12 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center min-h-[400px]">
              {paymentStatus === "prompted" ? (
                <>
                  <div className="w-20 h-20 bg-[#52B44B]/10 rounded-full flex items-center justify-center mb-6">
                    <Loader2 className="h-10 w-10 text-[#52B44B] animate-spin" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold mb-4 text-[#52B44B]">Check your phone</h2>
                  <p className="text-muted-foreground text-lg max-w-xs mx-auto">
                    We've sent an MPesa prompt to your phone. Enter your PIN to complete the payment of{" "}
                    <strong>KES {discountedTotal.toLocaleString()}</strong>.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-[#52B44B] rounded-full flex items-center justify-center mb-6">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <h2 className="font-serif text-2xl font-bold mb-4 text-[#52B44B]">Payment Successful</h2>
                  <p className="text-muted-foreground text-lg">Redirecting to your receipt...</p>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm sticky top-24">
            <h2 className="font-bold text-xl mb-6">Order Summary</h2>
            <div className="space-y-4 mb-6">
              {items.map((item) => (
                <div key={item.cake.id} className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16">
                      <RevealImage
                        src={item.cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                        alt={item.cake.name}
                        className="object-cover rounded-lg bg-muted"
                        fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                        timeoutMs={2500}
                      />
                    </div>
                    <span className="absolute -top-2 -right-2 bg-secondary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-1">{item.cake.name}</p>
                    <p className="text-muted-foreground text-xs">KES {item.cake.price.toLocaleString()}</p>
                  </div>
                  <div className="font-medium text-sm">KES {(item.cake.price * item.quantity).toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
              {promotionPreview.discountAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount{promotionPreview.label ? ` (${promotionPreview.label})` : ""}</span>
                  <span>- KES {promotionPreview.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-foreground pt-2">
                <span>Total</span>
                <span>KES {discountedTotal.toLocaleString()}</span>
              </div>
              {promotionPreview.message && <p className="pt-2 text-xs leading-5 text-muted-foreground">{promotionPreview.message}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolvePromotionPreview(
  promotions: Promotion[],
  items: { cake: { slug: string; name: string; price: number }; quantity: number }[],
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
