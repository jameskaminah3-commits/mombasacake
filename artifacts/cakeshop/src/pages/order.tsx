import { useParams, Link } from "wouter";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Package, MapPin, Phone, Receipt } from "lucide-react";
import { format } from "date-fns";

export default function OrderSuccess() {
  const { id } = useParams();
  const orderId = Number(id);
  
  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-3xl">
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">Order not found</h1>
        <Button asChild><Link href="/">Go Home</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-sm text-center mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
        <h1 className="font-serif text-4xl font-bold mb-2">Thank You!</h1>
        <p className="text-muted-foreground text-lg mb-8">Your order has been confirmed and is being prepared.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left border-y border-border py-6 mb-8 bg-muted/30 rounded-xl px-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Order Number</p>
            <p className="font-bold">#{order.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date</p>
            <p className="font-bold text-sm">{format(new Date(order.createdAt), 'MMM d, yyyy')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <p className="font-bold">KES {order.total.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
            <p className="font-bold text-primary capitalize">{order.status}</p>
          </div>
        </div>

        <Button asChild className="rounded-full bg-foreground hover:bg-foreground/90 px-8">
          <Link href="/menu">Continue Shopping</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-muted-foreground" /> Order Items
          </h3>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm border-b border-border/50 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="bg-muted px-2 py-1 rounded text-xs font-bold text-muted-foreground">{item.quantity}x</span>
                  <span className="font-medium">{item.cakeName}</span>
                </div>
                <span className="font-medium text-muted-foreground">KES {item.subtotal.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-muted-foreground" /> Delivery Details
            </h3>
            <p className="font-medium text-sm mb-1">{order.customerName}</p>
            <p className="text-muted-foreground text-sm mb-3">{order.deliveryAddress}</p>
            <p className="flex items-center text-sm text-muted-foreground"><Phone className="w-4 h-4 mr-2" /> {order.customerPhone}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" /> Payment Info
            </h3>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">MPesa</span>
            </div>
            {order.mpesaReceiptNo && (
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Receipt No.</span>
                <span className="font-medium">{order.mpesaReceiptNo}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-[#52B44B] uppercase text-xs tracking-wider bg-[#52B44B]/10 px-2 py-1 rounded">Paid</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
