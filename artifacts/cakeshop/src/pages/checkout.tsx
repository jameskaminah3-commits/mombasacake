import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCart } from "@/lib/cart-context";
import { useCreateOrder, useInitiateMpesaPayment, useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().regex(/^254\d{9}$/, "Must be a valid Safaricom number (254XXXXXXXXX)"),
  customerEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  deliveryAddress: z.string().min(5, "Delivery address is required"),
  notes: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "prompted" | "success" | "failed">("idle");

  const createOrder = useCreateOrder();
  const initiatePayment = useInitiateMpesaPayment();

  // Polling logic when payment is prompted
  const { data: orderData } = useGetOrder(activeOrderId as number, {
    query: {
      enabled: !!activeOrderId && paymentStatus === "prompted",
      queryKey: getGetOrderQueryKey(activeOrderId as number),
      refetchInterval: 3000,
    }
  });

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

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "254",
      customerEmail: "",
      deliveryAddress: "",
      notes: "",
    },
  });

  if (items.length === 0 && paymentStatus === "idle") {
    setLocation("/cart");
    return null;
  }

  const onSubmit = async (values: CheckoutFormValues) => {
    try {
      setPaymentStatus("processing");
      
      const orderItems = items.map(item => ({
        cakeId: item.cake.id,
        quantity: item.quantity
      }));

      // 1. Create order
      const order = await createOrder.mutateAsync({
        data: {
          ...values,
          items: orderItems,
        }
      });

      setActiveOrderId(order.id);

      // 2. Initiate MPesa
      await initiatePayment.mutateAsync({
        data: {
          orderId: order.id,
          phone: values.customerPhone,
          amount: order.total
        }
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
                  
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full h-14 rounded-full bg-[#52B44B] hover:bg-[#52B44B]/90 text-white font-bold text-base"
                    disabled={createOrder.isPending || initiatePayment.isPending}
                  >
                    {createOrder.isPending || initiatePayment.isPending ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                    ) : (
                      `Pay KES ${total.toLocaleString()} with MPesa`
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
                    We've sent an MPesa prompt to your phone. Enter your PIN to complete the payment of <strong>KES {total.toLocaleString()}</strong>.
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
                    <img src={item.cake.imageUrl || "/images/cake1.png"} alt={item.cake.name} className="w-16 h-16 rounded-lg object-cover bg-muted" />
                    <span className="absolute -top-2 -right-2 bg-secondary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-1">{item.cake.name}</p>
                    <p className="text-muted-foreground text-xs">KES {item.cake.price.toLocaleString()}</p>
                  </div>
                  <div className="font-medium text-sm">
                    KES {(item.cake.price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-foreground pt-2">
                <span>Total</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
